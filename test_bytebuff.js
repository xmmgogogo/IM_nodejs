/**
 * Created by Administrator on 16-12-8.
 */

var ByteBuffer = require('./ByteBuffer');

/*************************基本操作****************************/

//压包操作
var sbuf = new ByteBuffer();
var buffer = sbuf.string('abc123你好')//变长字符串，前两个字节表示长度
    .int32(-999).uint32(999).float(-0.5)
    .int64(9999999).double(-0.000005).short(32767).ushort(65535)
    .byte(255)
    .vstring('abcd',5)//定长字符串,不足的字节补0x00
    .byteArray([65,66,67,68,69],5)//字节数组，不足字节补0x00
    .pack();//结尾调用打包方法

console.log(buffer);

//解包操作
var rbuf = new ByteBuffer(buffer);
//解包出来是一个数组
var arr = rbuf.string()//变长字符串，前两个字节表示长度
    .int32().uint32().float()
    .int64().double().short().ushort()
    .byte()
    .vstring(null,5)//定长字符串,不足的字节补0x00
    .byteArray(null,5)//字节数组，不足字节补0x00
    .unpack();//结尾调用解包方法

console.log(arr);