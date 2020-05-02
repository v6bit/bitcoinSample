//************************************************//
// ODIN sample based Bitcoin-Testnet of node.js   //
//          PPk Public Group @2016.               //
//           http://ppkpub.org                    //
//     Released under the MIT License.            //
//************************************************//
//对应比特币测试网络(Bitcoin testnet)的RPC服务接口访问参数
var RPC_USERNAME='admin1'; 
var RPC_PASSWORD='123';
var RPC_HOST="127.0.0.1";
var RPC_PORT=19001;

//测试使用的相关参数
TEST_REGISTER_ADDRESS='mkiytxYA6kxUC8iTnzLPgMfCphnz91zRfZ'; //测试用的注册者钱包地址，注意与比特币正式地址的区别
TEST_REGISTER_PUBKEY_HEX='022e9f31292873eee495ca9744fc410343ff373622cca60d3a4c926e58716114b9';  //16进制表示的注册者钱包公钥
TEST_REGISTER_HASH160='391ef5239da2a3904cda1fd995fb7c4377487ea9';  //HASH160格式的注册者钱包公钥
TEST_REGISTER_PRIVATE_KEY='cTAUfueRoL1HUXasWdnETANA7uRq33BUp3Sw88vKZpo9Hs8xWP82'; //测试用的注册者钱包私钥
TEST_REGISTER_WALLET_NAME='TestWallet1';  //测试的注册者钱包名称 

TEST_OWNER_ADDRESS ='mnxZSEktpuDFeHd5NmKJzFsm6ReT3wzfXL';  //对应标识所有者的比特币地址
TEST_OWNER_HASH160 ='51a09d25106715f09a14cac6367c3f4f2408590d';  //HASH160格式的对应标识所有者的地址公钥

MAX_N = 10;  //单个1ofN多重签名输出中最多允许的公钥数量N取值
MIN_UNSPENT_NUM = 2;  //最少作为输入需要的未使用交易记录数量
MIN_DUST_AMOUNT = 5757;  //最小有效交易金额,单位satoshi，即0.00000001 BTC
MIN_TRANSACTION_FEE = 20000; //矿工费用的最小金额，单位satoshi

PPK_ODIN_PREFIX='P2P is future!ppkpub.org->ppk:0';  //ODIN协议定义的前缀标识

console.log('Hello, ODIN register sample Bitcoin-Testnet.');
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
client.getaccount(TEST_REGISTER_ADDRESS,function(err, result) {
  if (err || result!=TEST_REGISTER_WALLET_NAME ) { //如不存在，则新导入测试帐号私钥
      console.log('Import the test account[',TEST_REGISTER_WALLET_NAME,']:',TEST_REGISTER_ADDRESS);
      client.importprivkey(TEST_REGISTER_PRIVATE_KEY,TEST_REGISTER_WALLET_NAME,function(err, imported_result) {
          if (err) return console.log(err);
          console.log('Imported OK:', imported_result);
          
          doOdinRegisterSample();
      });
  }else{ //如已存在，则直接执行示例
      console.log('The test account[',TEST_REGISTER_WALLET_NAME,'] existed. Address:',TEST_REGISTER_ADDRESS);
      
      doOdinRegisterSample();
  }

});

//对应ODIN开源项目的注册功能示例实现
function doOdinRegisterSample(){
    //获取未使用的交易用于生成新交易
    client.listunspent(6,9999999,[TEST_REGISTER_ADDRESS],function(err2, array_unspent) {
      if (err2) return console.log('ERROR[listunspent]:',err2);
      console.log('Unspent:', array_unspent);

      //组织ODIN注册信息数据块
      var ODIN_SETTING_DEMO = '{"title":"PPk-ODIN-sample","email":"ppkpub@gmail.com","auth":"2","ap_list":["http://ppkpub.org/AP/"]}';
      var ODIN_DATA_DEMO = PPK_ODIN_PREFIX+'RT'
              + String.fromCharCode(ODIN_SETTING_DEMO.length/256)+String.fromCharCode(ODIN_SETTING_DEMO.length%256)
              + ODIN_SETTING_DEMO;  //测试用ODIN注册信息
      console.log('ODIN_DATA_DEMO=',ODIN_DATA_DEMO);
      
      //构建1ofN多重签名输出来嵌入自定义的ODIN标识注册数据(N取值由配置参数MAX_N决定)
      var obj_multisig_txs = generateMultiSigTX(ODIN_DATA_DEMO);
      var multisig_tx_num  = obj_multisig_txs.tx_num;
      var multisig_txs_hex = obj_multisig_txs.hex;

      //生成所需输入交易定义块
      var min_unspent_amount   = MIN_DUST_AMOUNT*(multisig_tx_num+1)+MIN_TRANSACTION_FEE;
      var array_transaction_in = [];
      
      var sum_amount = 0;
      for(var uu=0;uu<array_unspent.length;uu++){
          var unspent_record=array_unspent[uu];
          if(unspent_record.amount>0){
              sum_amount += unspent_record.amount*100000000;
              array_transaction_in[array_transaction_in.length]={"txid":unspent_record.txid,"vout":unspent_record.vout,"amount":unspent_record.amount};
              
              if( sum_amount > min_unspent_amount && uu>=MIN_UNSPENT_NUM-1 ) //需要足够金额和数量的输入
                break;
          }
      }

      console.log('Transaction_in:', array_transaction_in);
      
      //确保新交易的输入金额和记录数量满足最小交易条件
      if (sum_amount<=min_unspent_amount) return console.log('Invalid unspent amount');
      if (array_transaction_in.length<MIN_UNSPENT_NUM) return console.log('Unspent num should be more than ',MIN_UNSPENT_NUM);

      
      
      //构建原始交易数据
      var rawtransaction_hex = '01000000';  // Bitcoin协议版本号，UINT32
      rawtransaction_hex += byteToHex(array_transaction_in.length) ; //声明输入交易数量
      for(var kk=0;kk<array_transaction_in.length;kk++){
          rawtransaction_hex += reverseHex(array_transaction_in[kk].txid)+uIntToHex(array_transaction_in[kk].vout); 
          rawtransaction_hex += "00ffffffff";   // 签名数据块的长度和序列号, 00表示尚未签名
      }
      
      rawtransaction_hex += byteToHex( multisig_tx_num +2) ;  //声明输出交易数量
      
      //首先添加一个输出交易声明标识所有者 
      rawtransaction_hex += uIntToHex(MIN_DUST_AMOUNT)+"00000000";  
      rawtransaction_hex += "1976a914" + TEST_OWNER_HASH160 +"88ac";  //输出地址对应标识拥有者的钱包地址
      
      //添加多重交易输出内容
      rawtransaction_hex += multisig_txs_hex;  
      
      //最后添加一个找零输出交易 
      var charge_amount = sum_amount - min_unspent_amount;
      console.log('sum_amount:', sum_amount);
      console.log('min_unspent_amount:', min_unspent_amount);
      console.log('charge_amount:', charge_amount);
      console.log('uIntToHex(',charge_amount,')=', uIntToHex(charge_amount));
      
      rawtransaction_hex += uIntToHex(charge_amount)+"00000000";  //找零金额,UINT64
      rawtransaction_hex += "1976a914" + TEST_REGISTER_HASH160 +"88ac";  //找零地址为发送者的钱包地址
      
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
          client.sendrawtransaction(signedtransaction_hex_str,false,function(err4, sended_tx){ //注意第二个参数缺省为false,如果设为true则指Allow high fees to force it to spend，会强制发送交易并将in与out金额差额部分作为矿工费用(谨慎!)
              if (err4) return console.log('ERROR[sendrawtransaction]:',err4);
              console.log('Sended TX:', sended_tx);
              
              //等待新区块的产生，确认注册结果
              console.log('Waiting for the pending TX to be confirmed by new blocks ...');
              setTimeout(function(){checkRegisterResult(sended_tx);},5000); //等待5秒后检查结果
          });
      });
    });
}

//将指定ODIN数据字符串构建为多重签名输出数据块
function generateMultiSigTX(str_odin_data){
  //将原始字节字符串转换为用16进制表示
  var str_odin_hex=stringToHex(str_odin_data);
  console.log('str_odin_hex=',str_odin_hex);
  
  //将16进制表示的ODIN数据块分割构建若干公钥
  var array_splited=str_odin_hex.match(/.{62}|.+$/g);  //注意这里用62而不是31，是因为转换为16进制表示的字符串长度变大为原始字节字符串的2倍
  var array_pubkey_hex=[];
  
  for(var kk=0;kk<array_splited.length;kk++){
      var temp_pubkey_hex='03'+byteToHex(array_splited[kk].length/2)+array_splited[kk];
      for(var pp=array_splited[kk].length;pp<62;pp=pp+2){ //对于长度不足的字符串用00补足
          temp_pubkey_hex+='00';
      }
     
      array_pubkey_hex[kk]=temp_pubkey_hex;
  }
  console.log( "array_pubkey_hex:\n",array_pubkey_hex );
  
  //构建1ofN多重签名输出来嵌入自定义的ODIN标识注册数据(N取值由配置参数MAX_N决定)
  var multisig_tx_num=0;
  var multisig_txs_hex="";
  
  for(var multisig_tx_num=0;multisig_tx_num*(MAX_N-1)<array_pubkey_hex.length;multisig_tx_num++){
      //多重签名输出的第一个公钥固定为标识注册者对应公钥
      var tmp_script_hex = "51" + byteToHex(TEST_REGISTER_PUBKEY_HEX.length/2) + TEST_REGISTER_PUBKEY_HEX;  
      
      var kk=0;
      for(kk=0;kk < MAX_N-1 && kk+multisig_tx_num*(MAX_N-1)<array_pubkey_hex.length;kk++){
         var tmp_pubkey=array_pubkey_hex[kk+multisig_tx_num*(MAX_N-1)];
         console.log('kk=',kk,',multisig_tx_num=', multisig_tx_num,',tmp_pubkey[',(kk+multisig_tx_num*(MAX_N-1)),']=',tmp_pubkey);
         
         tmp_script_hex += "21" + tmp_pubkey;
      }
      tmp_script_hex += byteToHex(0x50+kk+1)+"ae" ;
      
      console.log('tmp_script_hex[',multisig_tx_num,']:', tmp_script_hex);
      
      multisig_txs_hex += uIntToHex(MIN_DUST_AMOUNT)+"00000000"; //交易金额,UINT64
      
      console.log('     uIntToVarintHex(',tmp_script_hex.length/2,') =  ',uIntToVarintHex(tmp_script_hex.length/2));
      multisig_txs_hex += uIntToVarintHex(tmp_script_hex.length/2)+tmp_script_hex;
  }
  
  return {'tx_num':multisig_tx_num,'hex':multisig_txs_hex};
}

//查询确认注册结果
function checkRegisterResult(sended_tx){
    //查询刚广播的交易是否已被矿工确认接受存入区块链
    client.gettransaction(sended_tx,function(err1, tx_info){
          if (err1) return console.log('ERROR[gettransaction]:',err1);
          
          //console.log('tx_info:', tx_info);
          if(tx_info.confirmations>0){ //已经被区块链确认收录
              console.log('TX had been confirmed by ',tx_info.confirmations,' blocks.');
              
              var confirmed_block_hash=tx_info.blockhash;
              var block_index=tx_info.blockindex;
              
              client.getblock(confirmed_block_hash,function(err2, block_info){
                  if (err2) return console.log('ERROR[getblock]:',err2);
                  //console.log('block_info:', block_info);
                  
                  var block_height=block_info.height;
                  console.log('New ODIN is ',block_height+'.'+block_index);
                  process.exit();
             });
          } else { //尚未被确认收录，则继续等待下一次检查
              console.log('TX not been confirmed. Waiting...');
              setTimeout(function(){checkRegisterResult(sended_tx);},5000);
          }
     });
}

//1字节整数转换成16进制字符串
function byteToHex(val){
    var resultStr='';
    var tmpstr=parseInt(val%256).toString(16); 
    resultStr += tmpstr.length==1? '0'+tmpstr : tmpstr;  
    
    return resultStr;
}

//32位无符号整数转换成VARINT格式的16进制字符串
function uIntToVarintHex(val){
    var resultStr='';
    
    if(val<0xFD){
      resultStr = byteToHex(val);
    }else if(val<0xFFFF ){ 
      resultStr = 'FD'+byteToHex(val%256)+byteToHex(val/256)
    }else if(val<0xFFFFFFFF ){
      resultStr = 'FE'+uIntToHex(val);
    }
    
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
