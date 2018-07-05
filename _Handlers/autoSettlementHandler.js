'use strict';

var logger = require('../logger');
var config = require('../AppConfig');
var refundConfig = require('./HandlerConfig/AppConfig');
var rp = require('request-promise');
var fs = require("fs");
var Handlebars = require('handlebars');


var IP = config.URLRestInterface;
var autoSettlementList = IP + 'Internal/APII/UI/lastSettlementDate'
const getSettlementBatchURL = IP +'APII/ePay/CreateSettlementBatch';

function getDataForAutoSettlement(callback){

   logger.info({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' }, "Called get Data for autosettlements" + autoSettlementList );

   let jsonData= {
     "action": "lastSettlementDate"     
   }  

   let options = {
       method: 'POST',
       uri: autoSettlementList,
       body: jsonData,
       json: true 
   };


    logger.debug({}, "Before function call");


    rp(options)
      .then(function (parsedBody) {
       	logger.debug(JSON.stringify(parsedBody));
        logger.debug({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },'==================== Get data for Auto settlement successful==================');
        callback(parsedBody);
    })
    .catch(function (err) {
        // POST failed...
        logger.error({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },'==================== Get data for Auto settlement failed, better luck next time==================' + err);

    });

}


function ProcessSettlementBatch(msgbody) {

  logger.info({ fs: 'autoSettlementHandler.js ', func: 'ProcessSettlementBatch' },'Start to Create Settlement Batch' + getSettlementBatchURL);
  const options = {
    method: 'POST',
    uri: getSettlementBatchURL,
    body: msgbody,
    json: true // Automatically stringifies the body to JSON
  };
  logger.info(JSON.stringify(options));

  rp(options)
    .then(function(parsedBody) {
      logger.info({ fs: 'autoSettlementHandler.js ', func: 'ProcessSettlementBatch' },parsedBody, 'Process Settlement Batch call is successful');
    })
    .catch(function(err) {
      logger.error({ fs: 'autoSettlementHandler.js ', func: 'ProcessSettlementBatch' },err, 'Process Settlement Batch call failed');
    });

}

function ProceedWithCall(res){

    let arr = res.lastSettlementDate.data
    
    
    for (let i=0;i<arr.length;i++){

        if (arr[i].lastSettlementDate > 0 && arr[i].settlement.settlementType =="AUTO"){
           let dPeriod = 60*60*24*arr[i].settlement.autoPeriod;
           let toDate = arr[i].lastSettlementDate+ dPeriod;
           let currDate = new Date();
           if (toDate <= (currDate.getTime()/1000)){
           
               let json = {
                 'CreatedBy': 'system',
                 'SeviceCode': 'ALL',
                 'SPCode': arr[i].spCode,
                 'toDate': (arr[i].lastDate + dPeriod).toString(),
                 'fromDate': arr[i].lastSettlementDate.toString()
              };
              ProcessSettlementBatch(json);
           }
       }
    }  

}


function CreateSettlementBatches(){
    
   //try {
       getDataForAutoSettlement(ProceedWithCall);
       //setTimeout(function() { CreateSettlementBatches();}, 600000);
   //}
   //catch(e){
     //setTimeout(function() { CreateSettlementBatches();}, 600000);
   //}
    
}


var handleEvent = function(){
    setTimeout(function() { CreateSettlementBatches();}, 10000);
}

exports.handleEvent = handleEvent 