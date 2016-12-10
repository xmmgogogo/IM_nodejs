var net = require('net');
var ExBuffer = require('./ExBuffer');

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

    //添加BUFF内存的事件监控
    var exBuffer = new ExBuffer().ushortHead().littleEndian();
    exBuffer.on('data', onReceivePackData);

    // 为这个socket实例添加一个"data"事件处理函数
    sock.on('data', function(data) {
        console.log('DATA ' + sock.remoteAddress + ': ' + data.toString());

        exBuffer.put(data);//只要收到数据就往ExBuffer里面put
    });

    // 为这个socket实例添加一个"close"事件处理函数
    sock.on('close', function(data) {
        sock.emit("c_close");
    });

    //如果客户端几分钟后，没请求就断开客户端的链接
    //客户端默认是65秒发一次心跳,一般情况下2分钟左右比较好
    sock.setTimeout(10 * 1000, function() {
        console.log('over time 10s.');
//        sock.emit("c_close");
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
 * 当服务端收到完整的包时
 * @param buffer
 */
function onReceivePackData(buffer){
    var receive_data = buffer.toString();
    console.log("receive data: " + receive_data);

    if(receive_data) {
        try {
            receive_data = JSON.parse(receive_data);
            if(receive_data) //&&receive_data.hasOwnProperty("op")
            {
                //处理正常逻辑
                global.log("work ok: " + receive_data);

                //1, 系统消息
                //2, 私聊消息
                //3, 频道消息
            } else {
                global.log("error,receive_data is error2!");
                sock.write({"ret" : 101});
                sock.emit("c_close");
            }
        } catch(err) {
            global.err("parse receive_data : " + err.stack);
            sock.write({"ret" : 102});
            sock.emit("c_close");
        }
    } else {
        global.log("receive_data is error! ");
        sock.write({"ret" : 103});
        sock.emit("c_close");
    }
}

//log
var global = {
  log : function(o) {
      console.log(o);
  },

  error : function(o) {
      console.log(o);
  }
};

//清除过期客户端
var cleanup = [];

/**
 * 发送全服数据
 * @param myClient
 * @param data
 * @param clientList
 */
function sendSystem(myClient, data, clientList) {
    for(var i = 0; i < clientList.length; i++) {
        if(clientList[i] != myClient) {
            if(clientList[i].writable) {
                clientList[i].write('You said: "' + data + '"');
            } else {
                cleanup.push(clientList[i]);
                clientList[i].destroy();
            }
        }
    }

    //del all dead client
    for(var j = 0; j < cleanup.length; j++) {
        clientList.splice(clientList.indexOf(cleanup[j]), 1);
    }
}