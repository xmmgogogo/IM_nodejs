var net = require('net');
var HeadBodyBuffers = require('./head_body_buffers').HeadBodyBuffers;

var HOST = '0.0.0.0',
    PORT = 6969,
    system_key = 'XXOOOOXX',
    login_key = 'OOXXXXOO',
    chat_key = 'OOXXOOXX',

    //初始化客户端列表
    clientList = [],

    //登陆token
    token = [],

    //分组
    groupList = [],

    //私聊列表
    uIdList = []
;

// 创建一个TCP服务器实例，调用listen函数开始监听指定端口
var chatServer = net.createServer();

chatServer.on('connection', function(sock) {
    //保存当前客户端连接
    clientList.push(sock);

    // 我们获得一个连接 - 该连接自动关联一个socket对象
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

    //计算包buff
    var hdb = new HeadBodyBuffers(4, packetLength);
    hdb.on('packet', function (packet) {
        var head = packet.slice(0, 4);
        var body = packet.slice(4);
        console.log("body:", body.toString(), body.length);
        sock.write(packet);
    });

    // 为这个socket实例添加一个"data"事件处理函数
    sock.on('data', function(data) {
        console.log('DATA ' + sock.remoteAddress + ': ' + data.toString());

        //全服提示
        broadcast(sock, data, clientList);
    });

    // 为这个socket实例添加一个"close"事件处理函数
    sock.on('close', function(data) {
        sock.emit("c_close");
    });

    //如果客户端几分钟后，没请求就断开客户端的链接
    //客户端默认是65秒发一次心跳,一般情况下2分钟左右比较好
    sock.setTimeout(10 * 1000, function() {
        sock.emit("c_close");
    });

    //踢出处理
    sock.on("c_close", function() {
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);

        sock.end();
        sock.destroy();
    });
});

chatServer.listen(PORT, HOST);

console.log('Server listening on ' + HOST +':'+ PORT);


/**
 * 发送全服数据
 * @param myClient
 * @param data
 * @param clientList
 */
function broadcast(myClient, data, clientList) {
    for(var i=0; i < clientList.length; i++) {
        if(clientList[i] != myClient) {
            clientList[i].write('You said: "' + data + '"');
        }
    }
}

function packetLength(data) {
    return data.readUInt32BE(0);
}














//        function repeat(target, n) {
//            return (new Array(n + 1)).join(target);
//        }

// 回发该数据，客户端将收到来自服务端的数据
// var sendData = repeat('a', 11000) + '#';

//        data = sendData.toString();