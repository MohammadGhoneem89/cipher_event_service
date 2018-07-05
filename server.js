'use strict';

var config = global.config;
var amqpRecieve = require('amqplib/callback_api');
var amqpSend = require('amqplib/callback_api');
var RSVP = require('rsvp');
var MQSend = require('./IntegrationMQ/MQSendResponse.js');
var MQController = require('./Controller/MQController.js');
const withAutoRecovery = require('amqplib-auto-recovery');
var ip = require("ip");
var hConfig = require('./healthConfig.json');
const logger = require('./logger');
var openSend = require('amqplib');

const crypto = require('./crypto');
var MQConnStr = crypto.decrypt(config.amqp.url);

var HealthCheckHelper = require('./utils/health.js');
let heathService = new HealthCheckHelper("RTD", 10000, MQConnStr);

function SendHealthCheck(){
	
	    var outQueue =   hConfig.HealthConfig.outQueueName;
            var outMessage = CreateHealthAdvise(hConfig.HealthConfig.Request);
            SendMessage(outMessage,outqueue)
	    setTimeout(SendHealthCheck, hConfig.HealthConfig.heartBeatInterval);
}


var promiseSendHeartBeat = new RSVP.Promise(function(fulfill, reject) {
        fulfill();
});

promiseSendHeartBeat.then(function() {
		SendHealthCheck();
		logger.debug({ fs: 'MQListener.js ', func: 'promiseSendHeartBeat' },' [promiseSendHeartBeat] Promise Ended With Success promise Send Health Check!');
		
		
	}, function(err) {

		logger.error({ fs: 'MQListener.js ', func: 'promiseSendHeartBeat' },' [promiseSendHeartBeat] '+err);
		logger.error({ fs: 'MQListener.js ', func: 'promiseSendHeartBeat' },' [promiseSendHeartBeat] Promise Ended With Failure/Rejection!');
		
		
});

function CreateHealthAdvise(requestMessage){
	var outMessage=JSON.parse(JSON.stringify(requestMessage));
	outMessage.Header.serviceContainerIP=ip.address();
	outMessage.Header.TimeStamp=new Date().toLocaleString();
	outMessage.Header.UUID="HBEAT-"+new Date().toISOString();
	outMessage.Body.isException=false;
	outMessage.Body.message="Service is UP and Running!!!";
	outMessage.Body.registerDate=new Date().toLocaleString();
	return outMessage;
}



withAutoRecovery(amqpRecieve, {
   onError: (err) => {
		logger.error({ fs: 'MQListener.js ', func: 'withAutoRecovery' , error: err}," [AMQP] ");
	},
   isErrorUnrecoverable: (err) => false
  // for more see src/amqplib-auto-recovery.js
}).connect(MQConnStr, function(err, connRecieve) {
	if (err) {
          logger.error({ fs: 'MQListener.js ', func: 'withAutoRecovery' }," [AMQP] ", err.message);
	  logger.debug({ fs: 'MQListener.js ', func: 'withAutoRecovery' }," [AMQP] Connect Failed Retrying in 5000 ms Connecting At: " + MQConnStr);
	  return false;
	}
        MQController.init(SendMessage);

        
    connRecieve.createChannel(function(err, chRecieve) {
        var queueName = config.MessageQueueInfo.Input;
			chRecieve.assertQueue(queueName, {
            durable: false
        });
			logger.debug({ fs: 'MQListener.js ', func: 'withAutoRecovery' }, " [*] Waiting for messages in %s. To exit press CTRL+C", queueName);
			chRecieve.consume(queueName, function(msg) {
            //logger.debug(" [x] Received %s", msg.content.toString());
            
			ProcessIncommingMessage(JSON.parse(msg.content.toString()));
            logger.debug({ fs: 'MQListener.js ', func: 'withAutoRecovery' }, " [*] Waiting for messages");
        }, {
            noAck: true
        });
    });
});



function ParseAndValidateMessage(Msg) {

    
    return true;
    if (Msg.Header) {
		
	  	var FormattedMessage = JSON.stringify(Msg, null, 2);
		logger.debug({ fs: 'MQListener.js ', func: 'ParseAndValidateMessage' }, " [x] Message Received!!! \n"+FormattedMessage);
		logger.debug({ fs: 'MQListener.js ', func: 'ParseAndValidateMessage' }, " [x] Message Received!!!");
        if (Msg.Header.tranType == null || Msg.Header.tranType == 'undefined') {
            throw new Error(" [x] Header TranType must be defined");
        }
		else if(Msg.Header.tranType != '0200')
		{
			throw new Error(" [x] Header TranType must be 0200 Request Transaction");
		}
        if (Msg.Header.UUID == null || Msg.Header.UUID == 'undefined') {
            throw new Error(" [x] Header UUID must be defined");
        }
        return true;
		
    } else {
        throw new Error(" [x] Message Received Does Not Contain Header");
    }

}


function ProcessIncommingMessage(msg) {


    var promise = new RSVP.Promise(function(fulfill, reject) {

        if (ParseAndValidateMessage(msg)) {
            fulfill(msg);
            logger.debug({ fs: 'MQListener.js ', func: 'ProcessIncommingMessage' }, "Message Parsing and validation Completed Successfully For Message : " + Msg.Header.UUID);

        } else {
            reject(null, msg);
        }
		    

    });
	
	
    promise.then(function(msg) {
		logger.debug({ fs: 'MQListener.js ', func: 'ProcessIncommingMessage' }, ' [x] Promise Ended With Success starting to process transaction!');
		MQController.processTrnx(msg,SendMessage);
	}, function(err,msg) {
                logger.error({ fs: 'MQListener.js ', func: 'ProcessIncommingMessage' }, ' [x] '+err);
		logger.error({ fs: 'MQListener.js ', func: 'ProcessIncommingMessage' }, ' [x] Promise Ended With Failure/Rejection!');
		logger.error({ fs: 'MQListener.js ', func: 'ProcessIncommingMessage' }, ' [x] Message Discarded with UUID : '+ Msg.Header.UUID);
		
    });

}

var ConnMQ={};


startSend()
  .then((ch)=>{
	ConnMQ=ch;
	logger.debug({ fs: 'MQListener.js ', func: 'startSend' }, "MQ Connection Loaded Successfully!!!");
	logger.debug({ fs: 'MQListener.js ', func: 'startSend'},"MQ Connection Loaded Successfully!!!");
 	}).catch((err)=>{
		logger.error({ fs: 'MQListener.js ', func: 'startSend' , error: err}, "MQ Connection Loaded error!!!");
});

function startSend() {
  return openSend.connect(MQConnStr)
    .then((conn) => conn.createChannel())
    .catch((err) => {
      logger.error({ fs: 'MQListener.js ', func: 'startSend', error: err}, '[AMQP] reconnecting');
      return setTimeout(startSend, 1000);
    });
}



var MQOut = function (chSend,sendQueueName,Message){

    if (sendQueueName==""){
       sendQueueName= config.MessageQueueInfo.RealTime_Write;
    }
    chSend.assertQueue(sendQueueName, {durable: false});
    chSend.sendToQueue(sendQueueName, new Buffer(JSON.stringify(Message)));
    logger.debug(">>>>>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< [sendResponse] Request Message Sent Successfully To MQ!!!'");
};



function SendMessage(msg,outqueue){
    
    if (!outqueue) { outqueue = config.MessageQueueInfo.Output}
    
    ConnMQ.assertQueue(outqueue , {durable: false});
    ConnMQ.sendToQueue(outqueue , new Buffer(JSON.stringify(msg)));


    //MQSend.MQOut(MQConnStr,outqueue,CreateOutMessage("",msg));
}

function CreateOutMessage(trnxPayLoad,msg){
	var outMessage=JSON.parse(JSON.stringify(msg));
	//outMessage.Header.tranType="0210";
	//outMessage.Body={};
	//outMessage.Body.success=msg.success;
	//outMessage.Body.result=msg.message;
	var FormattedMessage = JSON.stringify(msg, null, 2);
	logger.debug(" [x] Sending Response Response MQ !!! \n"+FormattedMessage);
	return msg;
}
