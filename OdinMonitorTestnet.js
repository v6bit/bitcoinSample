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

PPK_ODIN_PREFIX='P2P is future!ppkpub.org->ppk:0';  //ODIN协议定义的前缀标识

console.log('Hello, ODIN monitor sample based Bitcoin-Testnet.');
console.log('     PPk Public Group @2016       ');

//初始化访问RPC服务接口的对象
var client = require('kapitalize')();

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

//记录已解析过的区块高度
var parsedBlockHeight=0;

setInterval(function(){doOdinMonSample();},1000);

// ODIN开源项目示例实现功能
function doOdinMonSample(){
    //获取区块链上已产生的区块总数
    client.getblockcount(function(err1, block_count) {
      if (err1) return console.log('ERROR[getblockcount]:',err1);
      console.log('block_count:', block_count);
      
      //对尚未解析过的新区块进行解析
      for(var block_height=parsedBlockHeight+1;block_height<block_count;block_height++){
          //获取指定区块HASH值
          client.getblockhash(block_height,function(err2, block_hash) {
              if (err2) return console.log('ERROR[getblockhash]:',err2);
             
              parseBlock(block_hash);
          });
          
          parsedBlockHeight=block_height;
      }
    });
}

//解析指定区块数据
function parseBlock(block_hash){
    //获取区块数据
    client.getblock(block_hash,function(err1, block_info) {
      if (err1) return console.log('ERROR[getblock]:',err1);

      //console.log('block_info:', block_info);
      var block_height=block_info.height;
      var tx_list=block_info.tx;
      
      console.log('Parsing block[',block_height,']:', block_hash);
      
      //对尚未解析过的新区块进行解析
      for(var kk=0;kk<tx_list.length;kk++){
          parseTransaction(block_height,tx_list[kk]);
      }
    });
}

//解析指定区块数据
function parseTransaction(block_height,tx_hash){
    //onsole.log('Parsing TX:', tx_hash);
    
    //检查刚广播的交易是否已被矿工确认接受存入区块链
    client.gettransaction(tx_hash,function(err1, tx_info){
          if (err1) return console.log('ERROR[gettransaction]:',err1);
          if (!err1){ 
              //console.log('tx_info:', tx_info);
              //console.log('TX had been confirmed by ',tx_info.confirmations,' blocks.');
              
              if(tx_info.confirmations>0){
                  var tx_in_block_index=tx_info.blockindex;
                  var tx_hex=tx_info.hex;
                  //console.log('TX hex: ',tx_hex);
                  
                  var odinRecord=parseOdinFromTxHex(tx_hex);
                  
                  if(odinRecord!=null){
                      var full_odin_id=block_height+'.'+tx_in_block_index;
                      console.log('Found a new ODIN[',full_odin_id,"]:\n",odinRecord);
                  }
              }
          }
     });
}

//从16进制表示的交易原始HEX字符串中提取出可能嵌入的ODIN标识注册信息
function parseOdinFromTxHex(tx_hex){
    var out_list=getOutListFromTxHex(tx_hex);
    //console.log('out_list:', out_list);

    var ownerAddress='';
    var registerAddress='';
    var odinSet;
    var strValidDataInScript='';

    for(var kk=0;kk<out_list.length;kk++){
        var script_hex=out_list[kk].script_hex;
        
        var parsedRecord=parseScriptHex(script_hex);
        if(parsedRecord!=null){
            if( parsedRecord.opcode==0xAE){
                if (registerAddress.length==0) 
                    registerAddress = parsedRecord.pubkeys[0];
                
                if(parsedRecord.embed_data.length>0)
                    strValidDataInScript+=parsedRecord.embed_data;
            }
            
            if (ownerAddress.length==0 && parsedRecord.opcode==0xAC) {
                ownerAddress = parsedRecord.addr_hash160;
            }
        }
    }

    //console.log( 'strValidDataInScript=',strValidDataInScript );

    var strPrefix=strValidDataInScript.substr(0,31);
    if(strPrefix==PPK_ODIN_PREFIX){
        var msgType=strValidDataInScript.substr(31,1);
        if(msgType=='R'){
            var msgFormat=strValidDataInScript.substr(32,1);
            var msgLen=strValidDataInScript.charCodeAt(33)*256+strValidDataInScript.charCodeAt(34);
            //console.log('msgType=',msgType,',msgFormat=',msgFormat,',msgLen=',msgLen);
            
            if(msgFormat=='T') //Normal text
                msgContent=strValidDataInScript.substr(35);
            else if(msgFormat=='G') //Gzip compressed data
                msgContent=gzuncompress(strValidDataInScript.substr(35));
                
            //console.log( 'msgContent=',msgContent );
            odinSet=eval('('+msgContent+')');
        }
        
        if (ownerAddress.length==0)  
            ownerAddress=registerAddress;

        odinRecord={
            'register_pubkey':registerAddress,
            'owner_address_hash160':ownerAddress,
            'setting':odinSet,
        };

        //console.log("Found ODIN:",odinRecord);
        return odinRecord;
    }
    
    return null;
}

//从16进制表示的交易原始HEX字符串中提取出输出交易列表
function getOutListFromTxHex(tx_hex){
    var from = 0;
    var ver=tx_hex.substr(from,4*2);
    from += 4*2;
    //console.log('ver=',ver);
    
    //获取输入数量，注意按变长INT类型处理
    var in_num=parseInt(tx_hex.substr(from,1*2),'16');
    from += 1*2;
    if(in_num==0xFD){
        in_num=parseInt(tx_hex.substr(from,2*2),'16');
        from += 2*2;
    }else if(in_num==0xFE){
        in_num=parseInt(tx_hex.substr(from,4*2),'16');
        from += 4*2;
    }
    //console.log('in_num=',in_num);
    
    for(var kk=0;kk<in_num;kk++){
        var in_tx_hash=tx_hex.substr(from,32*2);
        from += 32*2;
        var in_tx_vout=tx_hex.substr(from,4*2);
        from += 4*2;
        var sign_length=parseInt(tx_hex.substr(from,1*2),'16');
        from += 1*2 + sign_length*2;
        var sequence=tx_hex.substr(from,4*2);
        from += 4*2;
        
        //console.log('in_tx_hash=',in_tx_hash);
        //console.log('in_tx_vout=',in_tx_vout);
        //console.log('sign_length=',sign_length);
        //console.log('sequence=',sequence);
    }
    
    //获取输出数量，注意按变长INT类型处理
    var out_num=parseInt(tx_hex.substr(from,1*2),'16');
    from += 1*2;
    if(out_num==0xFD){
        out_num=parseInt(tx_hex.substr(from,2*2),'16');
        from += 2*2;
    }else if(out_num==0xFE){
        out_num=parseInt(tx_hex.substr(from,4*2),'16');
        from += 4*2;
    }
    //console.log('out_num=',out_num);
    
    var out_array=[];
    for(var kk=0;kk<out_num;kk++){
        var out_val=parseInt(reverseHex(tx_hex.substr(from,8*2)),'16')/100000000;
        from += 8*2;
        var script_length=parseInt(tx_hex.substr(from,1*2),'16');
        from += 1*2;
        var script_hex=tx_hex.substr(from,script_length*2);
        from += script_length*2;
        
        //console.log('out_val=',out_val);
        //console.log('script_length=',script_length);
        //console.log('script_hex=',script_hex);
        
        out_array[kk]={'out_btc':out_val,'script_hex':script_hex};
    }
    
    var lock_time=tx_hex.substr(from,4*2);
    from += 4*2;
    //console.log('lock_time=',lock_time);
    
    return out_array;
}

/*
从16进制表示的交易脚本script中提取出有效的内嵌数据
*/
function parseScriptHex(script_hex){
    var parsed_record=null;

    opcode1=parseInt(script_hex.substr(0,2),'16');
    opcode2=parseInt(script_hex.substr(script_hex.length-4,2),'16');
    opcode3=parseInt(script_hex.substr(script_hex.length-2,2),'16');
    
    //console.log('opcode:',opcode1,',',opcode2,',',opcode3);
    if(opcode1==0x51 && opcode3==0xAE){  //符合比特币协议的多重签名(MULTISIG)特征
        var str_embed_data='';
        var array_pubkeys=[];
        var from=2;
        pubkey_len=parseInt(script_hex.substr(from,1*2),'16');
        from+=1*2;
        pubkey_str=script_hex.substr(from,pubkey_len*2);
        array_pubkeys[0]=pubkey_str;
        from+=pubkey_len*2;
        //console.log("pubkeyLen1=",pubkey_len,",pubkeyStr=",pubkey_str);
        
        for(var pp=1;pp<opcode2-0x50;pp++){
            pubkey_len=parseInt(script_hex.substr(from,1*2),'16');
            from+=1*2;
            pubkey_str=script_hex.substr(from,pubkey_len*2);
            array_pubkeys[pp]=pubkey_str;
            //console.log("pubkeyLen[",pp+1,"]=",pubkey_len,",pubkeyStr=",pubkey_str);
            from+=pubkey_len*2;
            
            valid_data_len=parseInt(pubkey_str.substr(2,2),'16');
            
            temp_str=pubkey_str.substr(4,valid_data_len*2);
            for(var kk=0;kk<valid_data_len*2;kk+=2)
                str_embed_data += String.fromCharCode(parseInt(temp_str.substr(kk,2),'16')); 
        }
        parsed_record={
            'opcode':opcode3,
            'pubkeys':array_pubkeys,
            'embed_data':str_embed_data
        };
    }else if(opcode1==0x76 && opcode2==0x88 && opcode3==0xAC){  //符合比特币协议的普通转账交易(CHECKSIG)特征
        var from=2;
        pubkey_type=parseInt(script_hex.substr(from,1*2),'16');
        from+=1*2;
        pubkey_len=parseInt(script_hex.substr(from,1*2),'16');
        from+=1*2;
        pubkey_str=script_hex.substr(from,pubkey_len*2);
        from+=pubkey_len*2;
        //console.log("pubkeyType=",pubkey_type,"pubkeyLen=",pubkey_len,",pubkeyStr=",pubkey_str);
        
        parsed_record={
            'opcode':opcode3,
            'addr_hash160':pubkey_str
        };
    }
    //console.log('parsed_record=',parsed_record);
    
    return parsed_record;
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

//解压gzip压缩数据返回原始内容字符串
function gzuncompress(compressed_data){
    require('zlib'); 
    return zlib.gzUncompress(compressed_data);
}
