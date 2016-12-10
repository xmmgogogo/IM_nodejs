var net = require('net');
var ExBuffer = require('./ExBuffer');

var HOST = '0.0.0.0',
    PORT = 6969,
    system_key  = 'XXOOOOXX',       //系统密钥
    login_key   = 'OOXXXXOO',       //登录密钥
    chat_key    = 'OOXXOOXX',       //消息密钥

    IM_FROM_TYPE_SYSTEM = 1,        // 消息类型
    IM_CHAT_BORADCAST   = 401,      // 世界消息
    IM_CHAT_GROUP       = 402,      // 频道消息
    IM_CHAT_PRIVATE     = 403,      // 私聊消息

    IM_STAT            = 101,       // 统计服务器状态
    IM_CHECK_ONLINE    = 102,       // 判断用户是否在线
    IM_KICK_USER       = 103,       // 踢某用户下线
    IM_KICK_ALL        = 104,       // 踢所有用户下线
    IM_GROUP_USER_LIST = 105,       // 获取频道用户列表

    /**
     * 消息协议中长度部分的长度
     */
    IM_LENGTH_SIZE      = 2,
    IM_TYPE_SIZE        = 2,
    IM_HEADER_SIZE      = 4,
    IM_FROM_TYPE_SIZE   = 2,
    IM_BODY_MAX_LENGTH  = 2048,

    clientList      = [],            //初始化客户端列表
    loginToken      = [],            //登陆token
    groupList       = [],            //频道分组
    uIdList         = [],            //私聊列表
    cleanup         = [],           //清除过期客户端

    //个人缓存
    myclientSocket  = ''
;

// 创建一个TCP服务器实例，调用listen函数开始监听指定端口
var chatServer = net.createServer();

chatServer.on('connection', function(sock) {
    //保存当前客户端连接
    clientList.push(sock);
    myclientSocket = sock;

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
        sock.emit("c_close");
    });

    //如果客户端几分钟后，没请求就断开客户端的链接
    //客户端默认是65秒发一次心跳,一般情况下2分钟左右比较好
    sock.setTimeout(2 * 60 * 1000, function() {
        global.log('over time 120s.');
        sock.emit("c_close");
    });

    //错误处理
    sock.on("error", function(e){
        global.err("socket unknow err :" + e);
        sock.emit("c_close");
    });

    //踢出处理
    sock.on("c_close", function() {
        global.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);

        sock.end();
        sock.destroy();
    });
}).listen(PORT, HOST);

console.log('Server listening on ' + HOST +':'+ PORT);

/**
 * 当服务端收到完整的包时
 * @param buffer
 */
function onReceivePackData(buffer) {
    var receive_data = buffer.toString();
    console.log("Origin Receive Data: " + receive_data);

    if(receive_data) {
        try {
            /**
             * 长度：包头 + 包体的长度，用来防止粘包、确保消息数据的完整性，长度为`2个字节`，无符号整形
             * 包头：分为两个部分：
             * 第一部分为消息类型，长度为`2个字节`，无符号整形
             * 第二部分为来源类型，长度为`2个字节`，无符号整形
             * 包体：消息的具体内容，`json格式`
             */

            // 读取协议长度

            // 读取消息类型
            var imType = buffer.readUIntBE(0, 2);

            //读取来源类型
            var fromType = buffer.readUIntBE(2, 4);

            // 读取协议内容
            var body = receive_data.substr(4);

            global.log("Receive Client Data: imType:" + imType + ", fromType:" + fromType + ", body:" + body);

            //解开json对象
            body = JSON.parse(body);
            if(imType && body) {
                //logindata ---> {"userId":"10424662024378399","loginToken":"4fed","platformId":"10424662024378399","time":1481351721,"platformName":"Mianmian  Liu"}
                //system ---> {"groupId":"MINE_30001","uId":"10424662024378399"}

                //处理正常逻辑
                //1, 系统消息
                if(imType == IM_FROM_TYPE_SYSTEM || imType == IM_CHAT_BORADCAST) {
                    sendSystem(imType, body['msg'])
                }

                //2, 私聊消息
                //3, 频道消息

                //消息结束后，自动过滤失效连接
                cleanDieConnect();
            } else {
                global.log("ERROR : 3333");
                sendSystem(1, {msg : 'error:3333'});
                sock.emit("c_close");
            }
        } catch(err) {
            global.err("ERROR : 1111");
            sendSystem(1, {msg : 'error:1111'});
            sock.emit("c_close");
        }
    } else {
        global.log("ERROR : 2222");
        sendSystem(1, {msg : 'error:2222'});
        sock.emit("c_close");
    }
}

/**
 * 发送全服数据
 * @param imType
 * @param data
 */
function sendSystem(imType, data) {
    //发送消息这里我们需要进行2进制处理
    // 协议数据
    var msg = JSON.stringify(data);

    // 包体长度
    var bodyLen = Buffer.byteLength(msg);

    // 协议长度，包体长度+协议长度
    var maxLength = bodyLen + 4;

    //写入2个字节表示本次包长
    var headBuf = new Buffer(2);
    headBuf.writeUInt16BE(maxLength, 0);

    //写入2个字节表示本次消息类型)
    var imTypeBuf = new Buffer(2);
    imTypeBuf.writeUInt16BE(imType, 0);

    //写入2个字节表示本次协议内容)
    var fromTypeBuf = new Buffer(2);
    fromTypeBuf.writeUInt16BE(0, 0);

    //生成包体
    var bodyBuf = new Buffer(maxLength + 2);
    headBuf.copy(bodyBuf, 0, 0, 2);
    imTypeBuf.copy(bodyBuf, 2, 0, 2);
    fromTypeBuf.copy(bodyBuf, 4, 0, 2);

    bodyBuf.write(msg, 6);//6 = 2 + 2 + 2

    global.log("server send msg:" + bodyBuf);

    for(var i = 0; i < clientList.length; i++) {
//        if(clientList[i] != myclientSocket) {
            if(clientList[i].writable) {
                clientList[i].write(bodyBuf);
            } else {
                cleanup.push(clientList[i]);
                clientList[i].destroy();
            }
//        }
    }
}

/**
 * 消息结束后，自动过滤失效连接
 */
function cleanDieConnect() {
    //del all dead client
    for(var j = 0; j < cleanup.length; j++) {
        clientList.splice(clientList.indexOf(cleanup[j]), 1);
    }
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
