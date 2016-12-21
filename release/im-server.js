var net = require('net'),
    crypto = require('crypto'),
    ExBuffer = require('./node_modules/ExBuffer'),
    Sprintf = require('./node_modules/sprintf').sprintf,
    util = require("util");

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
 * 添加用户进全服列表
 * @param myClientSocket
 * @param imType
 * @param body
 */
function imLogin(myClientSocket, imType, body) {
    var userId          = body['userId'];
    var platformId      = body['platformId'];
    var platformName    = body['platformName'];

    // 验证登录数据是否完整
    if(userId < 0) {
        //error
    }

    if(platformId < 0) {
        //error
    }

    if(platformName < 0) {
        platformName = 'SYS:' + userId;
    }

    //1, 若用户已经登录，则关闭以前的连接，以这次登录的为准 todo
    var oldUserInfo = getUserId(userId);
    if(oldUserInfo) {
        var oldConn = oldUserInfo['Conn'];
        var oldGroupIds = oldUserInfo['GroupIds'];

        //1, 删掉当前USER里面频道表
        if(oldGroupIds) {
            for(var i in oldGroupIds) {
                if(oldGroupIds.hasOwnProperty(i)) {
                    groupListDelUser(oldGroupIds[i], userId);
                }
            }
        }

        //2, 关闭老的链接
        if(oldConn) {
            SendError(oldConn, IM_ERROR_CODE_RELOGIN, "other login")
        }
    }

    //2，写入新的UID
    var userInfo = {};
    userInfo.UserId         = userId;
    userInfo.PlatformId     = platformId;
    userInfo.PlatformName   = platformName;
    userInfo.Conn           = myClientSocket;
    userInfo.GroupIds       = [];
    userInfo.ExtInfo        = '';
    userMap[userId] = userInfo;

    //3，记录统计信息
    ConnectCount = Object.keys(userMap).length;
    if(ConnectCount > MaxConnectCount) {
        MaxConnectCount = ConnectCount
    }

    //4 发送登录成功的通知
    serverResponseStatus(myClientSocket, imType, body);
}

/**
 * 退出
 * @param body
 */
function imLogout(body) {
    var uId = body['userId'];
    global.log("user logout:" + uId);
}

/**
 * 用户加入频道
 * @param myClientSocket
 * @param imType
 * @param body
 *
 * groupList {group1:[1,2,3,4,5], group2:[1,2,3,4,5], group3:[1,2,3,4,5],}
 * userMap[GroupIds] [1,2,3,4,5,6,7]
 */
function joinGroup(myClientSocket, imType, body) {
    var uId          = body['uId'];
    var groupId      = body['groupId'];

    // 将频道id写入用户数据
    if(userMap.hasOwnProperty(uId) && userMap[uId]['GroupIds'].indexOf(groupId) < 0) {
        userMap[uId]['GroupIds'].push(groupId);
    }

    // 将用户数据写入group
    // 若频道不存在，则创建一个频道
    if(groupList[groupId] === undefined) {
        GroupCount++;

        //插入新用户
        groupList[groupId] = [];
        groupList[groupId].push(uId);
    }

    // stat 更新统计数目-频道数
    var maxCount = Object.keys(groupList).length;
    if(maxCount > MaxGroupCount) {
        MaxGroupCount = maxCount;
    }

    // 发送成功状态 | 传入extra，包含group参数
    serverResponseStatus(myClientSocket, imType, body, {groupId: groupId});
}

/**
 * 退出频道
 * @param myClientSocket
 * @param imType
 * @param body
 */
function quitGroup(myClientSocket, imType, body) {
    var uId          = body['uId'];
    var groupId      = body['groupId'];

    // 删除用户数据里面的频道
    if(userMap.hasOwnProperty(uId)) {
        var d_u_i = userMap[uId]['GroupIds'].indexOf(groupId);
        if(d_u_i >= 0) {
            delete userMap[uId]['GroupIds'][d_u_i];
        }
    }

    // 删除频道用户ID
    if(groupList.hasOwnProperty(groupId)) {
        var d_g_i = groupList[groupId].indexOf(uId);
        if(d_g_i >= 0) {
            delete groupList[groupId][d_g_i];
        }
    }

    //4 发送登录成功的通知
    serverResponseStatus(myClientSocket, imType, body);
}

/**
 * 每次客户端发完消息，服务器都需要做响应 + 需要带上下一次传值的Token ??? token验证
 * @param myClientSocket
 * @param imType
 * @param body
 * @param extra
 */
function serverResponseStatus(myClientSocket, imType, body, extra) {
    var userId = '';

    if(body.hasOwnProperty('userId')) {
        userId = body['userId'];
    } else if(body.hasOwnProperty('sendId')) {
        userId = body['userId'];
    } else if(body.hasOwnProperty('uId')) {
        userId = body['uId'];
    }

    console.log("[serverResponseStatus]: " + util.inspect(body));

    if(userId) {
        // 创建新token
        var lastToken = generateToken(userId);
        //global.log('lastToken::' + lastToken);

        // 发送登录成功的通知
        sendSuccess(myClientSocket, imType, lastToken, IM_RESPONSE_CODE_SUCCESS, extra);
    }
}

/**
 * 给客户端发送一个成功的response
 * @param socket
 * @param imType
 * @param token
 * @param responseCode
 * @param extra 如果有就添加，如果没有就算了
 */
function sendSuccess(socket, imType, token, responseCode, extra) {
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
    send(socket, IM_RESPONSE, IM_FROM_TYPE_SYSTEM, body);
}

/**
 * 给客户端发送一个错误
 * @param socket
 * @param errorCode
 * @param errorMsg
 */
function SendError(socket, errorCode, errorMsg) {
    var body = {};
    body["code"] = errorCode;
    body["msg"] = errorMsg;

    // 发送消息
    send(socket, IM_ERROR, IM_FROM_TYPE_SYSTEM, body);
}

function send(socket, imType, fromType, body) {
    // 生成完整包数据
    var data = VA_formatMsgHeader(imType, fromType, body);

    // 发送消息
    socket.write(data);
}

/**
 *@param   str 字符串
 @param   key 秘钥
 */
function md5(str, key){
    var decipher = crypto.createHash('md5',key);
    if(key){
        return decipher.update(str).digest()
    }
    return decipher.update(str).digest('hex')
}

// 创建一个token
function generateToken(userId) {
    var tokenStr = Sprintf("%s#%s#%d", CHAT_KEY, userId, Date.now());
    var md5Str = md5(tokenStr);
    return md5Str.substr(0, 4);
}

/**
 * 获取用户map里面的UID
 * @param userId
 * @returns {*}
 */
function getUserId(userId) {
    return userMap[userId];
}

/**
 * 删除指定分组里面的用户ID
 * @param groupId
 * @param uId
 */
function groupListDelUser(groupId, uId) {
    // 删除频道用户ID
    if(groupList.hasOwnProperty(groupId)) {
        var d_g_i = groupList[groupId].indexOf(uId);
        if(d_g_i >= 0) {
            delete groupList[groupId][d_g_i];
        }
    }
}

/**
 * 服务器状态返回
 * @param clientSocket
 */
function imStat(clientSocket) {
    var sRunTime = (Date.now() - systemRunStartTime).toString();
    var startTime = systemRunStartTime.toString();

    var systemStatus =  {
        startTime                   : startTime.substr(0, startTime.length -3),
        runTime                     : sRunTime.substr(0, sRunTime.length -3),
        connectCount                : ConnectCount,
        maxConnectCount             : MaxConnectCount,
        groupCount                  : GroupCount,
        maxGroupCount               : MaxGroupCount,
        privateMessageCount         : PrivateMessageCount,
        boradcastMessageCount       : BoradcastMessageCount,
        groupMessageCount           : GroupMessageCount,
        sysBoradcastMessageCount    : SysBoradcastMessageCount,
        sysPrivateMessageCount      : SysPrivateMessageCount,
        sysGroupMessageCount        : SysGroupMessageCount
    };

    send(clientSocket, IM_STAT, IM_FROM_TYPE_SYSTEM, systemStatus);
}

/**
 * 处理判断用户是否在线
 */
function imCheckOnline(clientSocket, body) {
    var UserId = body['uId'];

    if(userMap.hasOwnProperty(UserId)) {
        body['onLine'] = 1;
    } else {
        body['onLine'] = 0;
    }

    // 直接发送结果
    send(clientSocket, IM_CHECK_ONLINE, IM_FROM_TYPE_SYSTEM, body);
}

/**
 * 踢用户下线
 */
function imKickUser(myClientSocket, imType, body) {
    var UserId = body['userId'];
    var messageBody = body['msg'];

    if(userMap.hasOwnProperty(UserId)) {
        // 直接发送结果
        send(userMap[UserId]['Conn'], IM_KICK_USER, IM_FROM_TYPE_SYSTEM, {msg : messageBody});
    }

    // 发送成功状态
    serverResponseStatus(myClientSocket, imType, "");
}

/**
 * 踢所有用户下线 | 为什么不直接踢掉
 */
function imKickAll(myClientSocket, imType, body) {
    var UserId = body['userId'];
    var messageBody = body['msg'];

    if(userMap) {
        for(UserId in userMap) {
            if(userMap.hasOwnProperty(UserId)) {
                // 直接发送结果
                send(userMap[UserId]['Conn'], IM_KICK_USER, IM_FROM_TYPE_SYSTEM, {msg : messageBody});
            }
        }
    }

    // 发送成功状态
    serverResponseStatus(myClientSocket, imType, "");
}

/**
 * 获取频道人员列表
 */
function imGroupUserList(myClientSocket, body) {
    var groupId = body['groupId'];

    if(groupList.hasOwnProperty(groupId)) {
        // 直接发送结果
        send(myClientSocket, IM_KICK_USER, IM_FROM_TYPE_SYSTEM, {userList : groupList[groupId]});
    }
}

/**
 * 获取频道列表
 */
function imGroupIdList(myClientSocket) {
    // 直接发送结果
    send(myClientSocket, IM_KICK_USER, IM_FROM_TYPE_SYSTEM, {idList : Object.keys(groupList)});
}

/**
 * 发送全服数据
 * @param myClientSocket    socket
 * @param imType    201,401
 * @param fromType  0,1,2
 * @param body
 */
function imChatBoardCast(myClientSocket, imType, fromType, body) {
    if(imType == IM_FROM_TYPE_SYSTEM) {
        // stat 统计信息-发送系统消息数
        SysBoradcastMessageCount++;
    } else {
        // stat 统计信息-发送广播消息数
        BoradcastMessageCount++;
    }

    // 发送者信息
    var UserId = body['sendId'];
    var senderInfo = {};
    if(userMap.hasOwnProperty(UserId)) {
        senderInfo = userMap[UserId];
    } else if(fromType == IM_FROM_TYPE_AI) {
        //压力测试用
        senderInfo = {UserId : UserId, PlatformId : UserId, PlatformName : 'AI' + UserId};
        fromType = 0;
    } else {
        SendError(myClientSocket, IM_ERROR_CODE_USER_INFO, '');
        return;
    }

    body["senderId"] = senderInfo.UserId;
    body["senderPlatformId"] = senderInfo.PlatformId;
    body["senderPlatformName"] = senderInfo.PlatformName;
    body["senderExtInfo"] = '';

    global.log("[World Send]: " + util.inspect(body));

    // 生成完整包数据
    // 生成完整包数据
    var data = VA_formatMsgHeader(imType, 0, body);//todo 写死0

    // 遍历所有在线用户，发送消息
    for(var uId in userMap) {
        if(userMap.hasOwnProperty(uId)) {
            var Conn = userMap[uId]['Conn'];
            if(Conn) {
                Conn.write(data);
            }
        } else {
            global.log("hasOwnProperty error: " + uId);
        }
    }

    // 发送成功状态
    serverResponseStatus(myClientSocket, imType, body);
}

/**
 * 频道聊天
 * @param myClientSocket
 * @param imType
 * @param fromType
 * @param body
 */
function imChatGroup(myClientSocket, imType, fromType, body) {
    if(imType == IM_FROM_TYPE_SYSTEM) {
        // stat 统计信息-发送系统消息数
        SysGroupMessageCount++;
    } else {
        // stat 统计信息-发送广播消息数
        GroupMessageCount++;
    }

    // 发送者信息
    var UserId = body['sendId'];
    var groupId = body['groupId'];
    if(userMap.hasOwnProperty(UserId)) {
        var senderInfo = userMap[UserId];
    } else {
        SendError(myClientSocket, IM_ERROR_CODE_USER_INFO, '');
        return;
    }

    body["senderId"] = senderInfo.UserId;
    body["senderPlatformId"] = senderInfo.PlatformId;
    body["senderPlatformName"] = senderInfo.PlatformName;
    body["senderExtInfo"] = '';

    global.log("[Group Send]: " + util.inspect(body));

    // 生成完整包数据
    // 生成完整包数据
    var data = VA_formatMsgHeader(imType, fromType, body);

    // 遍历当前频道全部用户，发送消息
    if(groupList.hasOwnProperty(groupId)) {
        var myGroupLen = groupList[groupId].length;
        for(var i = 0; i < myGroupLen; i++) {
            var sendUid = groupList[groupId][i];
            if(userMap[sendUid] !== undefined) {
                var Conn = userMap[sendUid]['Conn'];
                if(Conn) {
                    Conn.write(data);
                }
            }
        }
    }

    // 发送成功状态
    serverResponseStatus(myClientSocket, imType, body)
}

/**
 * 私聊
 * @param myClientSocket
 * @param imType
 * @param fromType
 * @param body
 */
function imChatPrivate(myClientSocket, imType, fromType, body) {
    if(imType == IM_FROM_TYPE_SYSTEM) {
        // stat 统计信息-系统私聊消息数
        SysPrivateMessageCount++;
    } else {
        // stat 统计信息-发送私聊消息数
        PrivateMessageCount++;
    }

    var uId = body['uId'];//发送者ID
    var receiverId = body['receiverId'];//接受者ID

    // 接受者信息
    if(userMap.hasOwnProperty(receiverId)) {
        var receiverInfo = userMap[receiverId];
    } else {
        // 对方不在线，给发送方发送对方不在线的notice | IM_RESPONSE_CODE_RECEIVER_OFFLINE 应该返回成功
        //SendError(myClientSocket, IM_ERROR_CODE_USER_INFO, '');
        return IM_RESPONSE_CODE_RECEIVER_OFFLINE;
    }

    body["receiverId"] = receiverId;
    body["receiverPlatformId"] = receiverInfo.PlatformId;
    body["receiverPlatformName"] = receiverInfo.PlatformName;
    body["receiverExtInfo"] = receiverInfo.ExtInfo;

    // 发送者信息
    if(userMap.hasOwnProperty(UserId)) {
        var senderInfo = userMap[UserId];
    } else {
        SendError(myClientSocket, IM_ERROR_CODE_USER_INFO, '');
        return;
    }

    body["senderId"] = senderInfo.UserId;
    body["senderPlatformId"] = senderInfo.PlatformId;
    body["senderPlatformName"] = senderInfo.PlatformName;
    body["senderExtInfo"] = senderInfo.ExtInfo;

    global.log("[Private Send]: " + util.inspect(body));

    // 生成完整包数据
    // 生成完整包数据
    var data = VA_formatMsgHeader(imType, fromType, body);

    // 发送消息
    var Conn = userMap[receiverId]['Conn'];
    if(Conn) {
        Conn.write(data);
    }

    // 发送成功状态
    serverResponseStatus(myClientSocket, imType, body);
}

/**
 * 组装数据
 * @param imType
 * @param fromType
 * @param data
 * @returns {Buffer}
 */
function VA_formatMsgHeader(imType, fromType, data) {
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
}

//log
var global = {
    log : function(o) {
        console.log(o);
    },

    err : function(o) {
        console.log(o);
    }
};

// ---------------------socket服务器开始-----------------------------------------------

// 创建一个TCP服务器实例，调用listen函数开始监听指定端口
var chatServer = net.createServer();
chatServer.setMaxListeners(0);

chatServer.on('connection', function(sock) {
    //socket对象
    global.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

    //添加BUFF内存的事件监控
    //ushortHead 前后端约定包头长度为2字节
    //bigEndian  前后端约定用大字节序
    var exBuffer = new ExBuffer().ushortHead().bigEndian();
    exBuffer.on('data', onReceivePackData);

    //接受消息
    sock.on('data', function(data) {
        //只要收到数据就往ExBuffer里面put
        exBuffer.put(data);
    });

    //关闭连接
    sock.on('close', function() {
        sock.emit("server_close");
    });

    //如果客户端几分钟后，没请求就断开客户端的链接
    //客户端默认是65秒发一次心跳,一般情况下2分钟左右比较好
    //sock.setTimeout(2 * 60 * 1000, function() {
    //    //global.log('over time 120s.');
    //    //sock.emit("server_close");
    //});

    //错误处理
    sock.on("error", function(e){
        sock.emit("server_close");
    });

    //踢出处理
    sock.on("server_close", function() {
        global.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);

        sock.end();
        sock.destroy();
    });

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
                var fromType = buffer.readUIntBE(IM_TYPE_SIZE, IM_FROM_TYPE_SIZE);

                // 读取协议内容
                var body = receive_data.substr(IM_HEADER_SIZE);

                global.log("Receive Data: " + util.inspect(body));

                //解开json对象
                body = JSON.parse(body);
                if(imType && body) {
                    //{"userId":"10424662024378399","loginToken":"4fed","platformId":"10424662024378399","time":1481351721,"platformName":"Mianmian  Liu"}
                    //{"groupId":"MINE_30001","uId":"10424662024378399"}

                    //处理正常逻辑
                    switch(imType) {
                        case IM_FROM_TYPE_SYSTEM:
                            //1, 系统消息(后台)
                            imChatBoardCast(sock, imType, IM_FROM_TYPE_SYSTEM, body);
                            break;
                        case IM_CHAT_BORADCAST:
                            //1, 系统消息(游戏)
                            imChatBoardCast(sock, imType, fromType, body);
                            break;
                        case IM_CHAT_GROUP:
                            //2, 频道消息
                            imChatGroup(sock, imType, IM_FROM_TYPE_SYSTEM, body);
                            break;
                        case IM_CHAT_PRIVATE:
                            //3, 私聊消息
                            imChatPrivate(sock, imType, IM_FROM_TYPE_SYSTEM, body);
                            break;
                        case IM_STAT:
                            //4, 查看服务器状态
                            imStat(sock);
                            break;
                        case IM_CHECK_ONLINE:
                            //5, 判断用户是否在线
                            imCheckOnline(sock, body);
                            break;
                        case IM_KICK_USER:
                            //6, 踢某用户下线
                            imKickUser(sock, imType, body);
                            break;
                        case IM_KICK_ALL:
                            //7, 踢所有用户下线
                            imKickAll(sock, imType, body);
                            break;
                        case IM_GROUP_USER_LIST:
                            //8, 获取频道用户列表
                            imGroupUserList(sock);
                            break;
                        case IM_GROUP_ID_LIST:
                            //8, 获取频道列表
                            imGroupIdList(sock);
                            break;
                        case IM_LOGIN:
                            //9, 登录
                            imLogin(sock, imType, body);
                            break;
                        case IM_LOGOUT:
                            //10, 退出
                            imLogout(body);
                            break;
                        case IM_JOIN_GROUP:
                            //11, 加入频道
                            joinGroup(sock, imType, body);
                            break;
                        case IM_QUIT_GROUP:
                            //12, 退出频道
                            quitGroup(sock, imType, body);
                            break;
                    }
                } else {
                    sock.emit("server_close");
                }
            } catch(err) {
                sock.emit("server_close");
            }
        } else {
            sock.emit("server_close");
        }
    }
}).listen(PORT, HOST);

global.log('Server listening on ' + HOST +':'+ PORT);

// ---------------------socket服务器结束-----------------------------------------------