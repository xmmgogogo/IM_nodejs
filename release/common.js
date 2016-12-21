var HOST = '0.0.0.0',
    PORT = 3000,

// 消息协议中长度部分的长度
    IM_LENGTH_SIZE          = 2,
    IM_HEADER_SIZE          = 4,                    // IM_TYPE_SIZE + IM_FROM_TYPE_SIZE
    IM_TYPE_SIZE            = 2,
    IM_FROM_TYPE_SIZE       = 2,
    IM_BODY_MAX_LENGTH      = 2048,

// 密钥
    SYSTEM_KEY              = 'XXOOOOXX',           // 系统密钥
    LOGIN_KEY               = 'OOXXXXOO',           // 登录密钥
    CHAT_KEY                = 'OOXXOOXX',           // 消息密钥

// 来源类型
    IM_FROM_TYPE_USER       = 0,                    // 消息类型 - 个人
    IM_FROM_TYPE_SYSTEM     = 1,                    // 消息类型 - 系统
    IM_FROM_TYPE_AI         = 2,                    // 机器人

    IM_ERROR                = 1,                    // 给client发送一条错误消息，一般来说，client收到IM_ERROR，都需要断开当前连接并重新连接，如果是重复登录，则只断开、不重连
    IM_RESPONSE             = 2,                    // 返回消息给client

// 消息类型
    IM_LOGIN                = 201,                  // 登录
    IM_LOGOUT               = 202,                  // 退出
    IM_REGISTER_EXT_INFO    = 203,                  // 注册附加信息
    IM_JOIN_GROUP           = 301,                  // 加入频道
    IM_QUIT_GROUP           = 302,                  // 退出频道
    IM_CHAT_BORADCAST       = 401,                  // 世界消息
    IM_CHAT_GROUP           = 402,                  // 频道消息
    IM_CHAT_PRIVATE         = 403,                  // 私聊消息

    IM_STAT                 = 101,                   // 统计服务器状态
    IM_CHECK_ONLINE         = 102,                   // 判断用户是否在线
    IM_KICK_USER            = 103,                   // 踢某用户下线
    IM_KICK_ALL             = 104,                   // 踢所有用户下线
    IM_GROUP_USER_LIST      = 105,                   // 获取频道用户列表
    IM_GROUP_ID_LIST        = 106,                   // 获取频道列表

// 错误消息
    IM_ERROR_CODE_RELOGIN                   = 1,     // 重复登录
    IM_ERROR_CODE_NO_LOGIN                  = 2,     // 未登录
    IM_ERROR_CODE_PACKET_READ               = 3,     // 读取协议包错误
    IM_ERROR_CODE_PACKET_BODY               = 4,     // 解析协议包内容错误
    IM_ERROR_CODE_NOT_ALLOWED_IMTYPE        = 5,     // 没有权限发送协议
    IM_ERROR_CODE_PRIVATE_KEY_NOT_MATCHED   = 6,     // 私钥不匹配
    IM_ERROR_CODE_LOGIN_TOKEN_NOT_MATCHED   = 7,     // 登录token不匹配
    IM_ERROR_CODE_TOKEN_NOT_MATCHED         = 8,     // 消息token不匹配
    IM_ERROR_CODE_MSG_EMPTY                 = 9,     // 聊天内容为空
    IM_ERROR_CODE_USERID                    = 10,    // 用户id错误，小于=0
    IM_ERROR_CODE_PLATFORMID                = 11,    // 平台id错误
    IM_ERROR_CODE_PLATFORMNAME              = 12,    // 平台名称错误
    IM_ERROR_CODE_GROUPID                   = 13,    // 频道id错误，小于=0
    IM_ERROR_CODE_USER_INFO                 = 14,    // 读取用户登录信息错误
    IM_ERROR_CODE_GROUP_INFO                = 15,    // 读取频道消息错误
    IM_ERROR_CODE_EXT_INFO_LENGTH           = 16,    // 附加信息长度超出限制

// 缓存数据
    userMap                                 = {},    // 用户map {uid => {'UserId' => 'lmm', 'PlatformId':'101'}}
    groupList                               = {},    // 频道分组 {'group1' => [1,2,3], 'group2' : []}
    cleanupList                             = [],    // 清除过期客户端

// 系统返回类型、默认是0
    IM_RESPONSE_CODE_SUCCESS                = 0,    // 默认code值
    IM_RESPONSE_CODE_RECEIVER_OFFLINE       = 1     // 私聊对象不在线
    ;

/**
 * 服务器status统计.
 */
var ConnectCount                    = 0,            // 当前客户端总连接数
    MaxConnectCount                 = 0,            // 历史客户端总连接数
    GroupCount                      = 0,            // 当前分组数量
    MaxGroupCount                   = 0,            // 历史分组最大数量
    SysBoradcastMessageCount        = 0,            // 系统-广播消息数
    SysPrivateMessageCount          = 0,            // 系统-私聊消息数
    SysGroupMessageCount            = 0,            // 系统-频道消息数
    BoradcastMessageCount           = 0,            // 广播消息数
    PrivateMessageCount             = 0,            // 私聊消息数
    GroupMessageCount               = 0,            // 频道消息数
    systemRunStartTime              = Date.now()    // 启动时间
    ;

/**
 * 每次客户端发完消息，服务器都需要做响应 + 需要带上下一次传值的Token ??? token验证
 * @param myClientSocket
 * @param imType
 * @param body
 * @param extra
 */
exports.serverResponseStatus = function(myClientSocket, imType, body, extra) {
    var userId = '';

    if(body.hasOwnProperty('userId')) {
        userId = body['userId'];
    } else if(body.hasOwnProperty('sendId')) {
        userId = body['userId'];
    } else if(body.hasOwnProperty('uId')) {
        userId = body['uId'];
    }

    console.log("======[serverResponseStatus]=======");
    console.log(body);

    if(userId) {
        // 创建新token
        var lastToken = this.generateToken(userId);
        //global.log('lastToken::' + lastToken);

        // 发送登录成功的通知
        this.sendSuccess(myClientSocket, imType, lastToken, IM_RESPONSE_CODE_SUCCESS, extra);
    }
};

/**
 * 给客户端发送一个成功的response
 * @param socket
 * @param imType
 * @param token
 * @param responseCode
 * @param extra 如果有就添加，如果没有就算了
 */
exports.sendSuccess = function(socket, imType, token, responseCode, extra) {
    var body = {};
    body["imType"] = imType;
    body["token"] = token;
    body["code"] = responseCode;

    // 附加扩展参数
    if(extra) {
        for(var key in extra) {
            if(extra.hasOwnProperty(key)) {
                body[key] = extra[key];
            }
        }
    }

    // 发送消息
    this.send(socket, IM_RESPONSE, IM_FROM_TYPE_SYSTEM, body);
};

/**
 * 给客户端发送一个错误
 * @param socket
 * @param errorCode
 * @param errorMsg
 */
exports.SendError = function(socket, errorCode, errorMsg) {
    var body = {};
    body["code"] = errorCode;
    body["msg"] = errorMsg;

    // 发送消息
    send(socket, IM_ERROR, IM_FROM_TYPE_SYSTEM, body);
};

exports.send = function(socket, imType, fromType, body) {
    // 生成完整包数据
    var data = this.VA_formatMsgHeader(imType, fromType, body);

    // 发送消息
    socket.write(data);
};


/**
 * 组装数据
 * @param imType
 * @param fromType
 * @param data
 * @returns {Buffer}
 */
exports.VA_formatMsgHeader = function(imType, fromType, data) {
    //发送消息这里我们需要进行2进制处理
    // 协议数据
    var msg = JSON.stringify(data);

    // 包体长度
    var bodyLen = Buffer.byteLength(msg);

    // 协议长度，包体长度+协议长度
    var maxLength = bodyLen + IM_HEADER_SIZE;

    //写入2个字节表示本次包长
    var headBuf = new Buffer(IM_LENGTH_SIZE);
    headBuf.writeUInt16BE(maxLength, 0);

    //写入2个字节表示本次消息类型)
    var imTypeBuf = new Buffer(IM_TYPE_SIZE);
    imTypeBuf.writeUInt16BE(imType, 0);

    //写入2个字节表示本次协议内容)
    var fromTypeBuf = new Buffer(IM_FROM_TYPE_SIZE);
    fromTypeBuf.writeUInt16BE(fromType, 0);

    //生成包体
    var bodyBuf = new Buffer(maxLength + IM_LENGTH_SIZE);
    headBuf.copy(bodyBuf, 0, 0, IM_LENGTH_SIZE);
    imTypeBuf.copy(bodyBuf, IM_LENGTH_SIZE, 0, IM_TYPE_SIZE);
    fromTypeBuf.copy(bodyBuf, IM_HEADER_SIZE, 0, IM_FROM_TYPE_SIZE);

    bodyBuf.write(msg, IM_LENGTH_SIZE + IM_HEADER_SIZE);//6 = 2 + 2 + 2

    return bodyBuf;
};

exports.ReadPacket = function (exBuffer) {
    //只要收到数据就往ExBuffer里面put
    //exBuffer.put(data);

    //ushortHead 前后端约定包头长度为2字节
    //bigEndian  前后端约定用大字节序
    //var exBuffer = new ExBuffer().ushortHead().bigEndian();
    exBuffer.on('data', onReceivePackData);

    /**
     * 当服务端收到完整的包时
     * @param buffer
     */
    function onReceivePackData(buffer) {
        var receive_data = buffer.toString();

        if(receive_data) {
            try {
                /**
                 * 长度：包头 + 包体的长度，用来防止粘包、确保消息数据的完整性，长度为`2个字节`，无符号整形
                 * 包头：分为两个部分：
                 * 第一部分为消息类型，长度为`2个字节`，无符号整形
                 * 第二部分为来源类型，长度为`2个字节`，无符号整形
                 * 包体：消息的具体内容，`json格式`
                 */

                // 读取消息类型
                var imType = buffer.readUIntBE(0, IM_TYPE_SIZE);

                //读取来源类型
                var fromType = buffer.readUIntBE(IM_TYPE_SIZE, IM_HEADER_SIZE);

                // 读取协议内容
                var body = receive_data.substr(IM_HEADER_SIZE);

                global.log("Receive Data: imType:[" + imType + "], fromType:[" + fromType + "], body:[" + body + "]");

                //解开json对象
                body = JSON.parse(body);
                if(imType && body) {
                    console.log("data::::::");
                    console.log(body);
                }
            } catch(e) {
                console.log('json data error(1)!');
            }
        } else {
            console.log('json data error(2)!');
        }
    }
};

// 创建一个token
exports.generateToken = function() {
    return 'abcd';
};