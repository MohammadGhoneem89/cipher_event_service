'use strict';

const logger = require('../logger');
var config = global.config;
var eventSubscriptions = require('../eventSubscriptions.json');
//var Core = require('../Core/APICore.js');
var RSVP = require('rsvp');
var MQSend = require('../IntegrationMQ/MQSendResponse.js');
var rp = require('request-promise');
var fs = require("fs");
var store = require('json-fs-store')();

const follow = require('follow');


/////////////////////////////////////////
////// External Handlers are defined here
//////////////////////////////////////////

const refundHandler = require ("../Handlers/refundHandler.js");
const disputeHandler = require ("../Handlers/disputeHandler.js");
const autoSettlementHandler = require ("../Handlers/autoSettlementHandler.js");


var IP = config.URLRestInterface;
var getExceptionURLEntity = IP + 'APII/ePay/getEntityData'
var getExceptionURLAcquirer = IP + 'APII/ePay/getAcquirerData'

const crypto = require('../crypto');
var MQConnStr = crypto.decrypt(config.amqp.url);

var bLocked = false;
var listnerCallBack;


var branch = {
    "subscribers" : [],
    "params" : {},
    "lastmsghash" : ""
}

var subscription = {
    "eventname" : "",
    "branches" : []
}


var responseMsg = {
   "header" : {
       "subscriberId" : "",
       "params" : "",
       "page" : ""
    },
    "body" : {
    }

}

function LoadFollowingData(){

   store.load('since', function(err, object){
       if(err) {
           let json = { id : "since", since : "now" }
           
           store.add(json, function(err) {
               //if (err) throw err; // err if the save failed
               //logger.info(JSON.stringify(json));
               FollowChanges(json);

           });


       }
       else {
            //logger.info(JSON.stringify(object));
            FollowChanges(object);
           
       }
   });

}


function StartFollowing(){

   logger.info({ fs: 'MQController.js ', func: 'StartFollowing' },"-----------Started the following of Events (1.1)-----------------");


   store.load('map', function(err, object){
            if(err) {
                 logger.info({ fs: 'MQController.js ', func: 'StartFollowing' },"We are in the error part");

                 let json = { id : "map", value : map }

                 store.add(json, function(err) {
                    if (err) throw err; // err if the save failed
                    logger.info({ fs: 'MQController.js ', func: 'StartFollowing' },JSON.stringify(map));
                 });
                 LoadFollowingData();

            }
            else {
                map = object.value;
                logger.info({ fs: 'MQController.js ', func: 'StartFollowing' },JSON.stringify(object.value) + " >>>>>>>>>>>>>>>>>>");

                logger.debug({ fs: 'MQController.js ', func: 'StartFollowing' },'spit out all');
                map.forEach(function(m){
                    logger.debug({ fs: 'MQController.js ', func: 'StartFollowing' },JSON.stringify(m));
                })
                LoadFollowingData();
            }
       
    });

    logger.info({ fs: 'MQController.js ', func: 'StartFollowing' },"-----------End Follow Events function-----------------");



}

var countTransactions =0
var latestTime = new Date();
var countConsolidateViewCnt =0

var getConsolidatedViewURL = IP + 'APII/ePay/CreateConsolidatedView'
var getSettlementBatchURL = IP+ 'APII/ePay/CreateSettlementBatch'
var notificationInterface = IP + 'APII/UI/notificationInsert'

function CreateConsolidatedView(){

   if (config.CONSOLIDATE_EVENT != "1") return;

var options = {
    method: 'POST',
    uri: getConsolidatedViewURL ,
    body: {
       "header":{
                "username": config.authentications.avanzaISC.username,
                "password": config.authentications.avanzaISC.password
       }
    },
    json: true // Automatically stringifies the body to JSON
};

logger.debug(JSON.stringify(options ));


rp(options)
    .then(function (parsedBody) {
       	logger.debug({ fs: 'MQController.js ', func: 'CreateConsolidatedView' },parsedBody);
        logger.debug({ fs: 'MQController.js ', func: 'CreateConsolidatedView' },'==================== Consolidated View Call is successful==================');
    })
    .catch(function (err) {
        // POST failed...
        logger.debug({ fs: 'MQController.js ', func: 'CreateConsolidatedView' },'==================== Consolidated View Call failed==================' + err);

    });

}


function TimerCheck(){

   try {
	    let json = {
                    "doc" : { "DocumentName" : "Transactions" } 
                         
               }
         HandleFollowEvent(json ,true);
   
         if (countConsolidateViewCnt > 0){
	        countConsolidateViewCnt=0;
	        SendDashBoardRelatedEvents("EntityWorkboard_Heading");
	        SendDashBoardRelatedEvents("AcquirerWorkBoard_Heading");
         }
	     setTimeout(function() { TimerCheck() },10000);
	   
   }
   catch(err){
	   setTimeout(function() { TimerCheck() },10000);
   }
   
   
   
}

setTimeout(function() { TimerCheck() },10000);

if (config.FABRICBUG == "1"){ 
  setTimeout(function() { RestartPeersDueToFabricBug() },10000);
}

autoSettlementHandler.handleEvent();

var lasttimeFollow = new Date().getTime()/1000;
let cmd=require('node-cmd');

function RestartPeersDueToFabricBug(){
   let l2 = new Date().getTime()/1000;
   console.log(l2);
   console.log(lasttimeFollow);
   console.log(l2-lasttimeFollow );

   if (l2-lasttimeFollow > config.FABRICBUG_PERIOD){
      let arr = config.FABRICBUG_PEERS
      lasttimeFollow = new Date().getTime()/1000;
      for (let i=0;i<arr.length;i++){
           
           console.log("restarting peer " + arr[i]);
           cmd.run('docker restart ' + arr[i]); 
      }

   }
   setTimeout(function() { RestartPeersDueToFabricBug() },10000);
}



function GenerateCTSLetter(json){
  
   let msg=
   {
          "Body":
          {
           "BatchType":"settlement",
           "BatchNumber":json.SettlementBatchNo,
           "OrgType":"entity",
           "ShortCode": json.SPCode,
           "UserId": json.INITBy
          }
   }
   
   listnerCallBack(msg,config.MessageQueueInfo.CTS);
}

function insertRefund(jsonData){

var options = {
    method: 'POST',
    uri: notificationInterface,
    body: jsonData,
    json: true // Automatically stringifies the body to JSON
};



rp(options)
    .then(function (parsedBody) {
       	logger.debug({ fs: 'MQController.js ', func: 'insertRefund' },parsedBody);
        logger.debug({ fs: 'MQController.js ', func: 'insertRefund' },'==================== Notification Request Sent==================');
    })
    .catch(function (err) {
        // POST failed...
        logger.debug({ fs: 'MQController.js ', func: 'insertRefund' },'==================== Notification Request Failed==================' + err);

    });

}



function SendNotificationsToRefundUsers(doc){
    
    
  
    logger.info({ fs: 'MQController.js ', func: 'SendNotificationsToRefundUsers' },JSON.stringify(doc));
    let comments  = doc.Comment;
    let refundRef = doc.RefundRef

    if (comments.length>0){
        let lastComment = comments[comments.length-1]
 
        let json = {

        
             "data": {
 		     "text": "Action: " + lastComment.Status + " Comments: " + lastComment.Text,
		     "action": "/viewRefund/" + refundRef,
		     "type": "Info",
		     "params": "",
                     "labelClass": "label label-sm label-info",
		     "createdBy": "System",
                     "userID": ""
             }
	}
	
        let results = [];
        comments.forEach((c)=> {
               if(!results.includes(c)){
                   results.push(c);
                   json.userID = c.User
                   logger.info({ fs: 'MQController.js ', func: 'SendNotificationsToRefundUsers' },"Notification sent for user" + c.User);
                   insertRefund(json);
               }
        })


        
   }
 
}




function HandleFollowEvent(change,timercheck){
  
  if(!timercheck){ 
     lasttimeFollow =new Date().getTime()/1000; 
     console.log("lasttimeFollow = " +  lasttimeFollow );
     console.log(JSON.stringify(change));
  }
  if( (change.doc && change.doc.DocumentName) ){
     
     if (change.doc.DocumentName == "Transactions"){
          
         if (countTransactions ==0) {  latestTime = new Date() }
         if (!timercheck){
              countTransactions ++;
              logger.info({ fs: 'MQController.js ', func: 'HandleFollowEvent' },'Some transaction data has come' + JSON.stringify(change.doc))
         }
         if (countTransactions >= config.minTranCount || ( countTransactions > 0  && ( new Date()).getTime()- latestTime.getTime())  > config.deltaInterval){
             countTransactions = 0;
             CreateConsolidatedView();
         }
     }
	 if(change.doc.DocumentName == "ConsolidatedView"){
	       countConsolidateViewCnt++
	 }
     if(change.doc.DocumentName == "Settlement" ){
           GenerateCTSLetter(change.doc);
           SendDashBoardRelatedEvents("EntityWorkboard_Heading");
     }
     if(change.doc.DocumentName == "Commission" ){
           SendDashBoardRelatedEvents("AcquirerWorkBoard_Heading");
     }
     if (change.doc.DocumentName == "RefundView" ||  change.doc.DocumentName == "RefundBatchView"){
           refundHandler.handleEvent(change.doc);
           
     }
     if (change.doc.DocumentName == "DisputeView" ||  change.doc.DocumentName == "DisputeBatchView"){
           disputeHandler.handleEvent(change.doc);
           
     }

  }
  

}

function SendDashBoardRelatedEvents(eventname){

   map.forEach(function(m){
          if(m.eventname== eventname){
                m.branches.forEach(function(b){
                   ProcessEvent(m.eventname,b);
                })
          }
   })


}


function FollowChanges(lastSeqJSON){
  logger.info({ fs: 'MQController.js ', func: 'FollowChanges' },"Follow changes - " + config.FeedFollowURL);
  logger.info({ fs: 'MQController.js ', func: 'FollowChanges' },"Follow changes - " + JSON.stringify(lastSeqJSON) );


  follow({db:config.FeedFollowURL, include_docs:true,since:lastSeqJSON.since,heartbeat :3000}, function(error, change) {
  if(!error) {
    
    //logger.info(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    //logger.info(JSON.stringify(change));
    //logger.info(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    
    HandleFollowEvent(change,false);

    let json = { id : "since", since : change.seq}
    store.add(json, function(err) {
        if (err) throw err; // err if the save failed
        //logger.info(">>>>>>>>>>>>" + JSON.stringify(json) + " >>>>>>>>>>>");

    });


    
  }
  else {
   
    //logger.info(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    //logger.info("there is an error");
    //logger.info(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
   
  }
})

}



StartFollowing();


var map = []


function unsubscribe(subscriberId,params,eventname,senderAddress){
   
  
   map.forEach(function(m){
      //logger.debug('The event name is ' + m.eventname);
      if (m.eventname == eventname){
           m.branches.forEach(function(d){
              let i = d.subscribers.map(function(s) { return s['id']; }).indexOf(subscriberId)
              //logger.debug('This is for finding for deletion ' + i);
              if (i>-1){
                 d.subscribers.splice(i,1);
              }
           })

      }

   })

   try {
   map.forEach(function(m){
      //logger.debug('Within parent removal logic The event name is ' + m.eventname);
      if (m.eventname == eventname){
          for(let j=0;j<m.branches.length;j++){
             //logger.debug('The length of array is ' + m.branches[j].subscribers.length);
             
             if (m.branches[j].subscribers.length ==0){
                m.branches.splice(j,1);
             }
          }
          

      }

   })
   }
   catch(err){logger.debug(err)}
 
   //logger.debug('After parent removal logic The event name is ' + m.eventname);
   


   /*logger.debug('spit out all');
   map.forEach(function(m){
      logger.debug(JSON.stringify(m));
   })*/

   let json = { id : "map", value : map }

   store.add(json, function(err) {
      logger.info({ fs: 'MQController.js ', func: 'unsubscribe' },'map changes added');
   });

}



function subscribe(subscriberId,params,eventname,senderAddress){
   
  
   //logger.debug('subscribe for message subscriberid=' + subscriberId + ' for event ' + eventname + ' params=' + JSON.stringify(params));

   let bDone =false;
   let bEventMatch = false;
   let matchedEvent  = {};

   map.some(function(m){
      //logger.debug('The event name is ' + m.eventname);

      if (m.eventname == eventname){
          matchedEvent= m;
          bEventMatch = true;
          m.branches.forEach(function(d){
              //logger.debug('The branch name is name is ' + d);

              
              if (JSON.stringify(d.params) == JSON.stringify(params)){
                 let index = d.subscribers.map(function(s) { return s['id']; }).indexOf(subscriberId)
                 //logger.debug('This is for the duplicate' + index);
                 if ( index <0 ){
                     d.subscribers.push({"id": subscriberId, "address": senderAddress});
                 }
                 else {
                     //logger.debug('duplicate subscription for subscription id ' + subscriberId);
                 }
                 bDone = true;
                 bEventMatch = false;
                 matchedEvent= {};
              }
              
          })

      }
   })

   if (bEventMatch){
       branch = {
         "subscribers" : [],
         "params" : params,
         "lastmsghash" : ""
       }

       var branch_cloned = Object.assign({}, branch );
       branch_cloned.subscribers.push({"id": subscriberId, "address": senderAddress});
       matchedEvent.branches.push(branch_cloned);
       matchedEvent
       bDone = true;
       
   }


   if (!bDone){
        logger.debug({ fs: 'MQController.js ', func: 'unsubscribe' },'inside the no find area ');
   
        subscription = {
            "eventname" : "",
            "branches" : []
        }
        branch = {
            "subscribers" : [],
            "params" : params,
            "lastmsghash" : ""
        }
        
        var sub_cloned = Object.assign({}, subscription);
        
        var branch_cloned = Object.assign({}, branch );
       
        branch_cloned.subscribers.push({"id": subscriberId, "address": senderAddress});
        
        sub_cloned.eventname = eventname;
        sub_cloned.branches.push(branch);
        logger.debug({ fs: 'MQController.js ', func: 'unsubscribe' },JSON.stringify(sub_cloned));

       
        map.push(sub_cloned);
   }
   
   logger.debug({ fs: 'MQController.js ', func: 'unsubscribe' },'the length of array is ' + map.length);
   logger.debug({ fs: 'MQController.js ', func: 'unsubscribe' },'spit out all');
   map.forEach(function(m){
      
       logger.debug({ fs: 'MQController.js ', func: 'unsubscribe' },JSON.stringify(m));
   })

   let json = { id : "map", value : map }

   store.add(json, function(err) {
      logger.info({ fs: 'MQController.js ', func: 'unsubscribe' },'map changes added');
   });
   
}


var init = function(callback){
   logger.debug({ fs: 'MQController.js ', func: 'init' },"In the init function");
   listnerCallBack = callback;
   //setTimeout(function() { CheckForResults()},3000);
}

function sendMessageToSubscribers(msg,branch,eventname){
     
     branch.subscribers.forEach(function (s){
          var msgFinal = Object.assign({},responseMsg);
          msgFinal.header.subscriberId = s.id;
          msgFinal.header.params = branch.params;
          msgFinal.header.page = eventname;
          msgFinal.body = msg;

          //logger.debug(JSON.stringify(msgFinal) + " sent to " + s.id + ' for the subscriber ' + s.address);
          if (listnerCallBack){
            listnerCallBack(msgFinal,s.address);
          }
          else {
             logger.debug({ fs: 'MQController.js ', func: 'sendMessageToSubscribers' },'Callback is lost ===' + err);

          }
    })

}

function ProcessEntityWorkboard(b,eventname){


logger.debug({ fs: 'MQController.js ', func: 'ProcessEntityWorkboard' },'Process Entity Workboard');

var options = {
    method: 'POST',
    uri: getExceptionURLEntity,
    body: b.params,
    json: true // Automatically stringifies the body to JSON
};

rp(options)
    .then(function (parsedBody) {
        sendMessageToSubscribers(parsedBody,b,eventname);
    })
    .catch(function (err) {
        logger.debug({ fs: 'MQController.js ', func: 'ProcessEntityWorkboard' },'Entity Workboard Call failed' + err);
    });

}

function ProcessAcquirerWorkboard(b,eventname){


var options = {
    method: 'POST',
    uri: getExceptionURLAcquirer,
    body: b.params,
    json: true // Automatically stringifies the body to JSON
};

rp(options)
    .then(function (parsedBody) {
        sendMessageToSubscribers(parsedBody,b,eventname);
    })
    .catch(function (err) {
        // POST failed...
    });

}



function ProcessEvent(eventname,b){
     logger.debug({ fs: 'MQController.js ', func: 'ProcessEvent' },'Process Event Called');
     let m= {};
      switch(eventname){
          case "EntityWorkboard_Heading":
             logger.debug({ fs: 'MQController.js ', func: 'ProcessEvent' },'Processing Entity Workboard');
             ProcessEntityWorkboard(b,eventname);
             break;
          case "AcquirerWorkBoard_Heading":
             ProcessAcquirerWorkboard(b,eventname);
             break;
      }
}

function CheckForResults(){
   try {
     if (!bLocked){
         bLocked = true;
         map.forEach(function(m){
             m.branches.forEach(function(b){
                 ProcessEvent(m.eventname,b);
             })
         })

         
      }
   }
   catch (exp){
      logger.debug({ fs: 'MQController.js ', func: 'CheckForResults' },'Exception in the Event loop');
   }
   
   bLocked=false;
   //setTimeout(function() { CheckForResults()},10000);
}

var processTrnx = function (msg){
	
	switch (msg.body.action){
           case "subscribe":
              subscribe(msg.body.subscriberId,msg.body.params,msg.body.event,msg.body.senderAddress)
              break;
		   case "unsubscribe" :
              unsubscribe(msg.body.subscriberId,msg.body.params,msg.body.event,msg.body.senderAddress);
        }
        
}

function PerformHealthCheck(trnxPayLoad){
	logger.debug({ fs: 'MQController.js ', func: 'PerformHealthCheck' },'Health Check Query Recieved!!!');
	var response = {
                success: true,
                message: 'Processed OK'
        };
	logger.debug({ fs: 'MQController.js ', func: 'PerformHealthCheck' },'Performing Health Check...');
	var outMessage = CreateOutMessage(trnxPayLoad,response,false);
	var outQueue = outMessage.Header.ResponseMQ.pop();
	MQSend.MQOut(MQConnStr,outQueue,outMessage);
	logger.debug({ fs: 'MQController.js ', func: 'PerformHealthCheck' },'Health Check Processed OK!!!');

}



exports.processTrnx = processTrnx
exports.init = init
