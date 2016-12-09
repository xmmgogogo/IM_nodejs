var net = require('net');
var HeadBodyBuffers = require('./head_body_buffers').HeadBodyBuffers;

function packetLength(data) {
    return data.readUInt32BE(0);
}

// simple client  test
var client = net.connect('172.17.5.168', 6969);
var hbd = new HeadBodyBuffers(4, packetLength);
hbd.on('packet', function (packet) {
    var head = packet.slice(0, 4);
    var body = packet.slice(4);

    console.log("body:", body.toString(), body.length);
    client.write(packet);
});

var keepAlive =   '{type:\"keepAlive\"}';
var packet = new Buffer(4 + Buffer.byteLength(keepAlive));
packet.writeUInt32BE(Buffer.byteLength(keepAlive),0);
packet.write(keepAlive,4);
client.write(packet);
client.on('data', function(data) {
    hbd.addBuffer(data);
});