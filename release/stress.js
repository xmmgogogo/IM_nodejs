var net = require('net');
var os = require('os');
var util = require('util');
var common = require('./common');
var cluster = require('cluster');
var initSharedMemory = require('./node_modules/sharedmemory').init;

// 创建共享内存的控制器
// 在master进程中，控制器负责维护共享内存
// 在worker进程中，控制器负责和master的控制器通信，通过IPC消息对共享内存进行读写操作
var sharedMemoryController = initSharedMemory();

var HOST = '172.17.5.168';
var PORT = 3000;
var maxCount = 1;
var totalMsg = 0;

var numCPUs = os.cpus().length;
//console.log(numCPUs);

//if(cluster.isMaster) {
//    for(var i = 0; i < numCPUs; i++) {
//        //FORK
//        cluster.fork();
//
//        cluster.on('exit',function(worker)
//        {
//            console.log("死进程: " + worker.process.pid);
//            console.log('系统内存总量: ' + parseInt(os.totalmem()/1024/1024) + " mb.");
//            console.log('系统空闲内存量: ' + parseInt(os.freemem()/1024/1024) + " mb.");
//            console.log('新启动进程ID: ' + process.pid);
//            console.log('节点进程的内存使用量: ' + util.inspect(process.memoryUsage()));
//            cluster.fork();
//        });
//    }
//} else {
//    console.log('slave start: ' + cluster.worker.id);

    //if (cluster.worker.id == 1) {
    //    // 第一个worker向共享内存写入一组数据，用a标记
    //    sharedMemoryController.set('a', [0, 1, 2, 3]);
    //}
    //
    //if (cluster.worker.id == 2) {
    //    // 第二个worker从共享内存读取a的值
    //    sharedMemoryController.get('a', function(data) {
    //        console.log(data);  // => [0, 1, 2, 3]
    //        // 删除
    //        sharedMemoryController.remove('a');
    //    });
    //}

    startImServer();
//}

/**
 * test 聊天服务器
 */
function startImServer() {
    for(var i = 0; i < maxCount; i++) {
        var client = new net.Socket();
        client.setMaxListeners(0);

        client.connect(PORT, HOST, function() {
            //console.log('CONNECTED TO: ' + HOST + ':' + PORT);
            // 建立连接后立即向服务器发送数据，服务器将收到这些数据

            var xxx = {"loginToken":"eb5e","platformId":"10424662024378399","time":1481797757,"token":"4c1c","userId":"10424662024378399","platformName":"Mianmian  Liu"};
            xxx.platformId = 10000 + totalMsg;
            xxx.userId = 10000 + totalMsg;
            xxx.platformName = 'AI NAME ' + totalMsg;

            //4 发送登录成功的通知
            common.serverResponseStatus(client, 201, xxx);

            for(var j = 0; j < 5; j++) {
                //sleep(1000 + Math.random() * 10);
                var sendId = parseInt(Math.random() * 1000000);
                var messageBody = {
                    sendId : '10424662024378399' ,
                    msg : 'AI SAY: ' + totalMsg,
                    icon: 'https://graph.facebook.com/424662024378399/picture',
                    vipLevel: 5,
                    imType: 401,
                    tabType: 1,
                    level: 56,
                    token: '4c1c',
                    sendName: 'Mianmian  Liu'
                };
                common.send(client, 401, 2, messageBody);
                totalMsg ++;
                console.log(totalMsg);
            }
        });

        // 为客户端添加“data”事件处理函数
        // data是服务器发回的数据
        client.on('data', function(data) {
            console.log('DATA: ' + data);
            // 完全关闭连接
            //client.destroy();
        });

        // 为客户端添加“close”事件处理函数
        client.on('close', function() {
            console.log('Connection closed');
        });

        client.on('error', function(e) {
            console.log(e);
        });
    }
}

//return;

function sleep(ms) {
    ms += new Date().getTime();
    while(new Date().getTime() < ms) {
    }
}



