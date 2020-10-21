'use strict';

var amqpSend = require('amqplib/callback_api');
const withAutoRecovery = require('amqplib-auto-recovery');
const logger = require('../logger');


function MQOut(MQConnStr,sendQueueName,Message,callback){
withAutoRecovery(amqpSend, {
   onError: (err) => {  console.log(err.message); callback(err);},
   isErrorUnrecoverable: (err) => false 
  // for more see src/amqplib-auto-recovery.js 
}).connect(MQConnStr, function(err, connSend) {
     try{
	   if(err){
		   logger.error({ fs: 'MQSendResponse', func: 'sendResponse'}," [sendResponse] Error Connecting: "+ err);
		   callback(err);
		   return false;
	   }
		connSend.createChannel(function(err, chSend) {
	   if(err)
	   {
		throw new Error(" [x] Error Creating Channel: "+ err);
		   logger.error({ fs: 'MQSendResponse', func: 'sendResponse'}," [x] Error Creating Channel: "+ err.stack || err);
	   }
		chSend.assertQueue(sendQueueName, {durable: false});
		chSend.sendToQueue(sendQueueName, new Buffer(JSON.stringify(Message)));
		logger.debug({ fs: 'MQSendResponse', func: 'sendResponse'}," [x] Response Sent Successfully!!!'");
                callback();
		setTimeout(function() { connSend.close(); }, 500);
	});
     }catch(err){
		 logger.error({ fs: 'MQSendResponse', func: 'promise'}," [sendResponse] Error While sending Out Message: "+ err);
	   return false;  
     }
});

 return true;
}


exports.MQOut = MQOut;

