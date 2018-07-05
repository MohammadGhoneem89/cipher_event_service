'use strict';

const logger = require('../logger');
var config = global.config;
var refundConfig = require('./HandlerConfig/AppConfig');
var rp = require('request-promise');
var fs = require("fs");
var Handlebars = require('handlebars');


var IP = config.URLRestInterface;
var autoSettlementList = IP + 'APII/UI/lastSettlementDate'
const getSettlementBatchURL = IP +'APII/ePay/CreateSettlementBatch';

function getDataForAutoSettlement(callback){

   logger.debug({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },"Called get Data for autosettlements" + autoSettlementList );

   let pBody = {
    "header":{
                "username": config.authentications.avanzaISC.username,
                "password": config.authentications.avanzaISC.password
    },
    "action": "lastSettlementDate"
   }

   console.log(JSON.stringify(pBody ));

   let options = {
       method: 'POST',
       uri: autoSettlementList,
       body: pBody,
       json: true
   };


    logger.debug({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },"Before function call");


    rp(options)
      .then(function (parsedBody) {
       	logger.debug({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },'==================== Get data for Auto settlement successful==================');
        callback(parsedBody);
    })
    .catch(function (err) {
        // POST failed...
        logger.debug({ fs: 'autoSettlementHandler.js ', func: 'getDataForAutoSettlement' },'==================== Get data for Auto settlement failed, better luck next time==================' + err);

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
  logger.info({ fs: 'autoSettlementHandler.js ', func: 'ProcessSettlementBatch' },JSON.stringify(options));

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
        logger.debug({ fs: 'autoSettlementHandler.js ', func: 'ProceedWithCall' },JSON.stringify(arr[i]));
        let lastSettlementDate = arr[i].lastSettlementDate;
        if(lastSettlementDate ==0) {
             lastSettlementDate = config.System_Start_Date;
        }
        
        if ( lastSettlementDate > 0 && arr[i].settlement.settlementType =="Auto"){
           
           let dPeriod = 60*60*24*arr[i].settlement.autoPeriod;
           dPeriod = Math.floor(dPeriod);
           let currDate = new Date();
           
           let currDateUnix =  currDate.getTime()/1000;
           let diff = currDateUnix - lastSettlementDate;
           let factor = Math.floor(diff/dPeriod)
           if (factor <1) return;
           let toDate = lastSettlementDate + (dPeriod*factor)
           toDate -= 1
           logger.debug({ fs: 'autoSettlementHandler.js ', func: 'ProceedWithCall' },"toDate" + toDate + ",currDate" + currDate + "dPeriod" + dPeriod + "lastSettlementDate" + lastSettlementDate );

           if (toDate <= (currDate.getTime()/1000)){
           
               let json = {
                 'CreatedBy': 'system',
                 'SeviceCode': 'ALL',
                 'SPCode': arr[i].spCode,
                 'toDate':   toDate.toString(),
                 'fromDate': lastSettlementDate.toString()
              };
              logger.debug({ fs: 'autoSettlementHandler.js ', func: 'ProceedWithCall' },JSON.stringify(json));
          
              ProcessSettlementBatch(json);
           }
       }
    }

}


function CreateSettlementBatches(){
   
   try {
       getDataForAutoSettlement(ProceedWithCall);
       setTimeout(function() { CreateSettlementBatches();}, 600000);
   }
   catch(e){
      logger.error({ fs: 'autoSettlementHandler.js ', func: 'CreateSettlementBatches' },e, 'Some error occurred while calling settlement loop');
      setTimeout(function() { CreateSettlementBatches();}, 600000);
     
   }
   
}


var handleEvent = function(){
    setTimeout(function() { CreateSettlementBatches();}, 10000);
}

exports.handleEvent = handleEvent
