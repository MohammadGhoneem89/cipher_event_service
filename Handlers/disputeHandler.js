'use strict';

const logger = require('../logger');
var config = global.config;
var disputeConfig = require('./HandlerConfig/AppConfig');
var rp = require('request-promise');
var fs = require("fs");
var Handlebars = require('handlebars');


var IP = config.URLRestInterface;
var notificationInterface = IP + 'APII/UI/notificationInsert'

function insertDispute(jsonData){


logger.info({ fs: 'disputeHandler.js ', func: 'insertDispute' },"The notification going is as follows" + JSON.stringify(jsonData))

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
    body: pBody,
    json: true // Automatically stringifies the body to JSON
};



rp(options)
    .then(function (parsedBody) {
       	logger.debug(JSON.stringify(parsedBody));
        logger.debug({ fs: 'disputeHandler.js ', func: 'insertDispute' },'==================== Notification Request Sent==================');
    })
    .catch(function (err) {
        // POST failed...
        logger.debug({ fs: 'disputeHandler.js ', func: 'insertDispute' },'==================== Notification Request Failed==================' + err);

    });

}

function handleDispute(doc){
    logger.info({ fs: 'disputeHandler.js ', func: 'handleDispute' },JSON.stringify(doc));
    let comments  = doc.Comment;
    let disputeRef = doc.DisputeRef

    if (comments.length>0){
        let lastComment = comments[comments.length-1]
 
        let json = {

             "action": "notificationInsert",
             "data": {
 		     "text": "Action: " + lastComment.Status + " Comments: " + lastComment.Text,
		     "action": "/viewDispute/" + disputeRef,
		     "type": "Info",
		     "params": "",
                     "labelClass": "label label-sm label-info",
		     "createdBy": "System",
                     "groupName": "Admin",
                     "userID": ""
             }
	}

        
        let notifyData = {
                 Original : doc.data,
                 lastComment : lastComment,
        }
        
  
        if (lastComment.Status=="Initiate Dispute"){
             let template = Handlebars.compile(disputeConfig.disputes.NotifyInitiate);
             
             json.data.text = template(notifyData)
             json.data.groupName = disputeConfig.disputes.checker_group;
             insertDispute(json);
        }
        
        
        if (lastComment.Status=="Rejected"){
             let template = Handlebars.compile(disputeConfig.disputes.NotifyRejected);
             json.data.text = template(notifyData)
             json.data.userID = comments[0].User;
             insertDispute(json);
             json.data.userID = "";
             json.data.groupName = disputeConfig.disputes.checker_group;
             insertDispute(json);
        }
        if (lastComment.Status=="Approved"){
             let template = Handlebars.compile(disputeConfig.disputes.NotifyApproved);
             json.data.text = template(notifyData)
             json.data.groupName = "";
             json.data.userID = comments[0].User;
             insertDispute(json);
             json.data.groupName = disputeConfig.disputes.checker_group;
             json.data.userID = "";
             insertDispute(json);
             
        }

	       
   }

}

function handleDisputeBatch(doc){
    
        let disputeRef = doc.DisputeBatchNo;
        let json = {

             "action": "notificationInsert",
             "data": {
 		     "text": "",
		     "action": "/viewDisputeBatch/" + disputeRef,
		     "type": "Info",
		     "params": "",
                     "labelClass": "label label-sm label-info",
		     "createdBy": "System",
                     "groupName": "",
                     "userID": "",
                     "orgCode" : ""
             }
	}

        let arr = doc.TransactionListDispute.split[','];
        let length = 1;
        if (arr) {
          length = arr.length;
        }
        
        let notifyData = {
                 Original : doc.data,
                 Count : length
        }
        
  
        if (doc.Status=="Initiated"){
             let template = Handlebars.compile(disputeConfig.disputes.NotifyInitiateBatch);
             json.data.orgCode = doc.AcquirerId;
             json.data.text = template(notifyData)
             //json.data.groupName = disputeConfig.disputes.acquirer_group;
             insertDispute(json);
        }
        if (doc.Status=="Processed"){
             let template = Handlebars.compile(disputeConfig.disputes.NotifyProcessedBatch);
             json.data.text = template(notifyData)
             json.data.groupName = disputeConfig.disputes.checker_group;
             insertDispute(json);
        }

  
}


var handleEvent = function(doc){
    
    if (doc.DocumentName =="DisputeView"){
        handleDispute(doc);
    }
    if (doc.DocumentName =="DisputeBatchView"){
        handleDisputeBatch(doc);
    }
 
}

exports.handleEvent = handleEvent
