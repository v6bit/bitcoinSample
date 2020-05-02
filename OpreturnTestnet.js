//************************************************//
//  RPC sample based Bitcoin-Testnet of node.js   //
//          PPk Public Group @2016.               //
//           http://ppkpub.org                    //
//     Released under the MIT License.            //
//************************************************//
//对应比特币测试网络(Bitcoin testnet)的RPC服务接口访问参数
var RPC_USERNAME='admin1'; 
var RPC_PASSWORD='123';
var RPC_HOST="127.0.0.1";
var RPC_PORT=19001;

//测试使用的钱包地址
TEST_ADDRESS='mkiytxYA6kxUC8iTnzLPgMfCphnz91zRfZ'; //测试用的钱包地址，注意与比特币正式地址的区别
TEST_PUBKEY_HEX='022e9f31292873eee495ca9744fc410343ff373622cca60d3a4c926e58716114b9';  //16进制表示的钱包公钥，待修改
TEST_HASH160='391ef5239da2a3904cda1fd995fb7c4377487ea9';  //HASH160格式的钱包公钥
TEST_PRIVATE_KEY='cTAUfueRoL1HUXasWdnETANA7uRq33BUp3Sw88vKZpo9Hs8xWP82'; //测试用的钱包私钥
TEST_WALLET_NAME='TestWallet1';  //测试的钱包名称 

MIN_DUST_AMOUNT=10000;  //最小有效交易金额,单位satoshi，即0.00000001 BTC
MIN_TRANSACTION_FEE=10000; //矿工费用的最小金额，单位satoshi

console.log('Hello, Bitcoin-Testnet RPC sample.');
console.log('     PPk Public Group @2016       ');

//初始化访问RPC服务接口的对象
var client = require('kapitalize')()

client
    .auth(RPC_USERNAME, RPC_PASSWORD)
    .set('host', RPC_HOST)
    .set({
        port:RPC_PORT
    });

//显示当前连接的比特币测试网络信息
client.getInfo(function(err, info) {
  if (err) return console.log(err);
  console.log('Info:', info);
});

//检查测试帐号是否已存在于测试节点
client.getaccount(TEST_ADDRESS,function(err, result) {
  if (err || result!=TEST_WALLET_NAME ) { //如不存在，则新导入测试帐号私钥
      console.log('Import the test account[',TEST_WALLET_NAME,']:',TEST_ADDRESS);
      client.importprivkey(TEST_PRIVATE_KEY,TEST_WALLET_NAME,function(err, imported_result) {
          if (err) return console.log(err);
          console.log('Imported OK:', imported_result);
          
          doRpcSample();
      });
  }else{ //如已存在，则直接执行示例
      console.log('The test account[',TEST_WALLET_NAME,'] existed. Address:',TEST_ADDRESS);
      
      doRpcSample();
  }
 
});

// 示例实现功能
function doRpcSample(){
    //获取未使用的交易用于生成新交易
    client.listunspent(6,9999999,[TEST_ADDRESS],function(err2, array_unspent) {
      if (err2) return console.log('ERROR[listunspent]:',err2);
      console.log('Unspent:', array_unspent);

      //测试数据定义
      var TEST_DATA='Peer-Peer-network is the future!';
      console.log('TEST_DATA=',TEST_DATA);
      
      //将原始字节字符串转换为用16进制表示
      var str_demo_hex=stringToHex(TEST_DATA);
      console.log('str_demo_hex=',str_demo_hex);
      
      //生成输入交易定义块
      var min_unspent_amount=MIN_DUST_AMOUNT*1+MIN_TRANSACTION_FEE;
      var array_transaction_in=[];
      
      var sum_amount=0;
      for(var uu=0;uu<array_unspent.length;uu++){
          var unspent_record=array_unspent[uu];
          if(unspent_record.amount>0){
              sum_amount+=unspent_record.amount*100000000;
              array_transaction_in[array_transaction_in.length]={"txid":unspent_record.txid,"vout":unspent_record.vout};
              
              if( sum_amount > min_unspent_amount )
                break;
          }
      }

      //确保新交易的输入金额满足最小交易条件
      if (sum_amount<=min_unspent_amount) return console.log('Invalid unspent amount');

      console.log('Transaction_in:', array_transaction_in);
      
      //构建原始交易数据
      var rawtransaction_hex = '01000000';  // Bitcoin协议版本号，UINT32
      rawtransaction_hex += byteToHex(array_transaction_in.length) ; //设置输入交易数量
      for(var kk=0;kk<array_transaction_in.length;kk++){
          rawtransaction_hex += reverseHex(array_transaction_in[kk].txid)+uIntToHex(array_transaction_in[kk].vout); 
          rawtransaction_hex += "00ffffffff";   // 签名数据块的长度和序列号, 00表示尚未签名
      }
      
      rawtransaction_hex += byteToHex(2);  //设置输出交易数量
      
      //使用op_return对应的备注脚本空间来嵌入自定义数据
      rawtransaction_hex += "0000000000000000";  
      rawtransaction_hex += byteToHex(2+str_demo_hex.length/2) + "6a" + byteToHex(str_demo_hex.length/2) +str_demo_hex; 
      
      //最后添加一个找零输出交易 
      var charge_amount = sum_amount - MIN_TRANSACTION_FEE;
      console.log('sum_amount:', sum_amount);
      console.log('min_unspent_amount:', min_unspent_amount);
      console.log('charge_amount:', charge_amount);
      console.log('uIntToHex(',charge_amount,')=', uIntToHex(charge_amount));
      
      rawtransaction_hex += uIntToHex(charge_amount)+"00000000";  //找零金额,UINT64
      rawtransaction_hex += "1976a914" + TEST_HASH160 +"88ac";  //找零地址为发送者的钱包地址
      
      rawtransaction_hex += "00000000"; //锁定时间,缺省设置成0，表示立即执行，是整个交易数据块的结束字段

      console.log('Rawtransaction:', rawtransaction_hex);
      
      //签名交易原始数据包
      client.signrawtransaction(rawtransaction_hex,function(err3, signedtransaction) {
          if (err3) return console.log('ERROR[signrawtransaction]:',err3);
          console.log('Signedtransaction:', signedtransaction);
          
          if (!signedtransaction.complete) return console.log('signrawtransaction failed');
          
          var signedtransaction_hex_str=signedtransaction.hex;
          console.log('signedtransaction_hex_str:', signedtransaction_hex_str);
          
          //广播已签名的交易数据包
          client.sendrawtransaction(signedtransaction_hex_str,false,function(err4, sended){
              //注意第二个参数缺省为false,如果设为true则指Allow high fees to force it to spend，
              //会强制发送交易并将in与out金额差额部分作为矿工费用(谨慎!)
              if (err4) return console.log('ERROR[sendrawtransaction]:',err4);
              console.log('Sended TX:', sended);
          });
      });
    });
}

//1字节整数转换成16进制字符串
function byteToHex(val){
    var resultStr='';
    var tmpstr=parseInt(val%256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    return resultStr;
}

//将HEX字符串反序输出
function reverseHex(old){
    var array_splited=old.match(/.{2}|.+$/g);
    var reversed='';
    for(var kk=array_splited.length-1;kk>=0;kk--){
        reversed += array_splited[kk];
    }
    return reversed;
}
//32位无符号整数变成16进制，并按翻转字节序
function uIntToHex(val){
    var resultStr='';
    var tmpstr=parseInt(val%256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    tmpstr=parseInt((val%65536)/256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    tmpstr=parseInt(parseInt(val/65536)%256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    tmpstr=parseInt(parseInt(val/65536)/256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    return resultStr;
}

//Ascii/Unicode字符串转换成16进制表示
function stringToHex(str){
    var val="";
    for(var i = 0; i < str.length; i++){
        var tmpstr=str.charCodeAt(i).toString(16);  //Unicode
        val += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    }
    return val;
}

//十六进制表示的字符串转换为Ascii字符串
function hexToString(str){
    var val="";
    var arr = str.split(",");
    for(var i = 0; i < arr.length; i++){
        val += arr[i].fromCharCode(i);
    }
    return val;
}

