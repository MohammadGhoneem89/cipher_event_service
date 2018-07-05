'use strict';

const logger = require('../logger');
var config = global.config;
var refundConfig = require('./HandlerConfig/AppConfig');
var rp = require('request-promise');
var fs = require("fs");
var Handlebars = require('handlebars');


var IP = config.URLRestInterface;
var notificationInterface = IP + 'APII/UI/notificationInsert'

function insertRefund(jsonData){

logger.info({ fs: 'refundHandler.js ', func: 'insertRefund' },"The notification going is as follows" + JSON.stringify(jsonData))

let pBody = {
    "header":{
                "username": config.authentications.avanzaISC.username,
                "password": config.authentications.avanzaISC.password
    },
    "action" : jsonData.action,
    "data" : jsonData.data
}

var options = {
    method: 'POST',
    uri: notificationInterface,
    body: pBody ,
    json: true // Automatically stringifies the body to JSON
};

console.log(JSON.stringify(options));


rp(options)
    .then(function (parsedBody) {
       	logger.debug({ fs: 'refundHandler.js ', func: 'insertRefund' },JSON.stringify(parsedBody));
        logger.debug({ fs: 'refundHandler.js ', func: 'insertRefund' },'==================== Notification Request Sent==================');
    })
    .catch(function (err) {
        // POST failed...
        logger.debug({ fs: 'refundHandler.js ', func: 'insertRefund' },'==================== Notification Request Failed==================' + err);

    });

}

function handleRefund(doc){
	logger.info({ fs: 'refundHandler.js ', func: 'handleRefund' },JSON.stringify(doc));
    let comments  = doc.Comment;
    let refundRef = doc.RefundRef

    if (comments.length>0){
        let lastComment = comments[comments.length-1]
 
        let json = {

             "action": "notificationInsert",
             "data": {
 		     "text": "Action: " + lastComment.Status + " Comments: " + lastComment.Text,
		     "action": "/viewRefund/" + refundRef,
		     "type": "Info",
		     "params": "",
                     "labelClass": "label label-sm label-info",
		     "createdBy": "System",
                     "groupName": "Admin",
                     "userID": ""
             }
	}

        
        let notifyData = {
                 Original : doc,
                 lastComment : lastComment,
        }
        
  
        if (lastComment.Status=="Initiate Refund"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyInitiate);
             
             json.data.text = template(notifyData)
             json.data.groupName = refundConfig.refunds.checker_group;
             insertRefund(json);
        }
        
        if (lastComment.Status=="insufficientFunds"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyInsufficient);
             json.data.text = template(notifyData)
             json.data.groupName = refundConfig.refunds.checker_group;
             insertRefund(json);
        }
        if (lastComment.Status=="Rejected"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyRejected);
             json.data.text = template(notifyData)
             json.data.userID = comments[0].User;
             insertRefund(json);
        }
        if (lastComment.Status=="Processed"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyProcessed);
             json.data.text = template(notifyData)
             json.data.groupName = "";
             json.data.userID = comments[0].User;
             insertRefund(json);
             json.data.groupName = refundConfig.refunds.checker_group;
             json.data.userID = "";
             insertRefund(json);
             
        }

	       
   }

}

function handleRefundBatch(doc){
    
        let refundRef = doc.RefundBatchNo;
        let json = {

             "action": "notificationInsert",
             "data": {
 		     "text": "",
		     "action": "/viewRefundBatch/" + refundRef,
		     "type": "Info",
		     "params": "",
                     "labelClass": "label label-sm label-info",
		     "createdBy": "System",
                     "groupName": "Admin",
                     "userID": "",
                     "orgCode" : ""
             }
	}

        let arr = doc.TransactionListRefund.split[','];
        let length = 1;
        if (arr) {
          length = arr.length;
        }
        
        let notifyData = {
                 Original : doc,
                 Count : length
        }
        
  
        if (doc.Status=="Initiated"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyInitiateBatch);
             json.data.orgCode = doc.AcquirerId;
             json.data.text = template(notifyData)
             //json.data.groupName = refundConfig.refunds.acquirer_group;
             insertRefund(json);
        }
        if (doc.Status=="Processed"){
             let template = Handlebars.compile(refundConfig.refunds.NotifyProcessedBatch);
             json.data.text = template(notifyData)
             json.data.groupName = refundConfig.refunds.checker_group;
             insertRefund(json);
        }

  
}


var handleEvent = function(doc){
    
    if (doc.DocumentName =="RefundView"){
        handleRefund(doc);
    }
    if (doc.DocumentName =="RefundBatchView"){
        handleRefundBatch(doc);
    }
 
}

exports.handleEvent = handleEvent
