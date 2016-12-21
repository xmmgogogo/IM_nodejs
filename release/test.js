var cluster = require('cluster');
var initSharedMemory = require('./node_modules/sharedmemory').init;
var os = require('os');
var util = require('util');
var numCPUs = os.cpus().length;

// 创建共享内存的控制器
// 在master进程中，控制器负责维护共享内存
// 在worker进程中，控制器负责和master的控制器通信，通过IPC消息对共享内存进行读写操作
var sharedMemoryController = initSharedMemory();

var userMap = {
    10001:{name:'lmj'},
    10002:{name:'lmj'}
};

if (cluster.isMaster) {
    //for(var i = 0; i < numCPUs; i++) {
    //    // fork第一个worker
    //    cluster.fork();
    //}

    // fork第一个worker
    cluster.fork();

    // 1秒后fork第二个worker
    setTimeout(function() {
        cluster.fork();
    }, 1000);
} else {
    getUserCacheData(1);
    saveUserCacheData();

    if (cluster.worker.id == 1) {
        // 第一个worker向共享内存写入一组数据，用a标记
        userMap[10002] = 2222;
        saveUserCacheData();
    }

    if (cluster.worker.id == 2) {
        // 第二个worker从共享内存读取a的值
        getUserCacheData(2);
    }
}


function saveUserCacheData() {
    //处理userMap即可
    console.log('save: ' + util.inspect(userMap));
    sharedMemoryController.set('userMap', userMap);
}

function getUserCacheData(num) {
    //处理userMap即可
    sharedMemoryController.get('userMap', function(data) {
        console.log('get ' + num + ":::" + util.inspect(data));
    });
}