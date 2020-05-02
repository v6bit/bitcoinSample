//************************************************//
//   Bitcoin-Testnet RPC sample of node.js        //
//          PPk Public Group ? 2016.              //
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
TEST_PRIVATE_KEY='cTAUfueRoL1HUXasWdnETANA7uRq33BUp3Sw88vKZpo9Hs8xWP82'; //测试用的钱包私钥
TEST_WALLET_NAME='TestWallet1';  //测试的钱包名称 

MIN_DUST_AMOUNT=10000;  //最小有效交易金额,单位satoshi，即0.00000001 BTC
MIN_TRANSACTION_FEE=10000; //矿工费用的最小金额，单位satoshi

console.log('Hello, Bitcoin-Testnet RPC sample.');
console.log('     PPk Public Group ? 2016      ');

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

//查看当前钱包下属地址账户余额变动情况
client.listaccounts(function(err, account_list) {
  if (err) return console.log(err);
  console.log("Accounts list:\n", account_list);
});

//检查测试帐号是否已存在于测试节点
client.getaccount(TEST_ADDRESS,function(err, result) {
  if (err || result!=TEST_WALLET_NAME ) { //如不存在，则新导入测试帐号私钥
      console.log('Import the test account[',TEST_WALLET_NAME,']:',TEST_ADDRESS);
      client.importprivkey(TEST_PRIVATE_KEY,TEST_WALLET_NAME,function(err, imported_result) {
          if (err) return console.log(err);
          console.log('Imported OK:', imported_result);
          
          doSample();
      });
  }else{ //如已存在，则直接执行示例
      console.log('The test account[',TEST_WALLET_NAME,'] existed. Address:',TEST_ADDRESS);
      
      doSample();
  }
 
});

// 示例实现功能
function doSample(){
    //获取未使用的交易(UTXO)用于构建新交易的输入数据块
    client.listunspent(6,9999999,[TEST_ADDRESS],function(err, array_unspent) {
      if (err) return console.log('ERROR[listunspent]:',err);
      console.log('Unspent:', array_unspent);

      var array_transaction_in=[];
      
      var sum_amount=0;
      for(var uu=0;uu<array_unspent.length;uu++){
          var unspent_record=array_unspent[uu];
          if(unspent_record.amount>0){
              sum_amount+=unspent_record.amount*100000000; //注意:因为JS语言缺省不支持64位整数，此处示例程序简单采用32位整数，只能处理交易涉及金额数值不大于0xFFFFFFF即4294967295 satoshi = 42.94967295 BTC。 实际应用程序需留意完善能处理64位整数
              array_transaction_in[array_transaction_in.length]={"txid":unspent_record.txid,"vout":unspent_record.vout};
              
              if( sum_amount > (MIN_DUST_AMOUNT+MIN_TRANSACTION_FEE) )
                break;
          }
      }
      
      //确保新交易的输入金额满足最小交易条件
      if (sum_amount<MIN_DUST_AMOUNT+MIN_TRANSACTION_FEE) return console.log('Invalid unspent amount');

      console.log('Transaction_in:', array_transaction_in);

      //生成测试新交易的输出数据块，此处示例是给指定目标测试钱包地址转账一小笔测试比特币
      //注意：输入总金额与给目标转账加找零金额间的差额即MIN_TRANSACTION_FEE，就是支付给比特币矿工的交易成本费用
      var obj_transaction_out={
          "mieC38pnPwMqbMAN6sGWwHRQ3msp7nRnNz":MIN_DUST_AMOUNT/100000000,   //目标转账地址和金额
          "mkiytxYA6kxUC8iTnzLPgMfCphnz91zRfZ":(sum_amount-MIN_DUST_AMOUNT-MIN_TRANSACTION_FEE)/100000000  //找零地址和金额，默认用发送者地址
        };
      
      console.log('Transaction_out:', obj_transaction_out);
      
      //生成交易原始数据包
      client.createrawtransaction(array_transaction_in,obj_transaction_out,function(err2, rawtransaction) {
          if (err2) return console.log('ERROR[createrawtransaction]:',err2);
          console.log('Rawtransaction:', rawtransaction);
          
          //签名交易原始数据包
          client.signrawtransaction(rawtransaction,function(err3, signedtransaction) {
              if (err3) return console.log('ERROR[signrawtransaction]:',err3);
              console.log('Signedtransaction:', signedtransaction);
              
              var signedtransaction_hex_str=signedtransaction.hex;
              console.log('signedtransaction_hex_str:', signedtransaction_hex_str);
              
              //广播已签名的交易数据包
              client.sendrawtransaction(signedtransaction_hex_str,false,function(err4, sended) { //注意第二个参数缺省为false,如果设为true则指Allow high fees to force it to spend，会在in与out金额差额大于正常交易成本费用时强制发送作为矿工费用(谨慎!)
                  if (err4) return console.log('ERROR[sendrawtransaction]:',err4);
                  console.log('Sended TX:', sended);
                  
                  client.listaccounts(function(err, account_list) {
                      if (err) return console.log(err);
                      console.log("Accounts list:\n", account_list); //发送新交易成功后，可以核对下账户余额变动情况
                    });
              });
          });
      });
    });
}
