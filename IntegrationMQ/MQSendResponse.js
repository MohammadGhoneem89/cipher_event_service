'use strict';

const logger = require('../logger');
var amqpSend = require('amqplib/callback_api');
var RSVP = require('rsvp');
const withAutoRecovery = require('amqplib-auto-recovery');

var MQOut = function (MQConnStr,QueueName,Message){

var promise = new RSVP.Promise(function(fulfill, reject) {

  if (sendResponse(MQConnStr,QueueName,Message)) {
    fulfill(null,Message);
    logger.debug({ fs: 'MQSendResponse.js ', func: 'promise' },"Message Sent Successfully Message : "+Message.Header.UUID);

  } else {
    reject(null,Message);
  }

});

promise.then(function(err,msg) {
   logger.debug({ fs: 'MQSendResponse.js ', func: 'promise' },'Promise Ended With Success!');

}, function(err,msg) {
   logger.error({ fs: 'MQSendResponse.js ', func: 'promise' },'Promise Ended With Failure/Rejection!');
   logger.error({ fs: 'MQSendResponse.js ', func: 'promise' }," [x] " + err);
});


}



function sendResponse(MQConnStr,sendQueueName,Message){



withAutoRecovery(amqpSend, {
   onError: (err) => {
     logger.error({ fs: 'MQSendResponse.js ', func: 'sendResponse' },err, 'error message'+err.message);
},
   isErrorUnrecoverable: (err) => false
  // for more see src/amqplib-auto-recovery.js
}).connect(MQConnStr, function(err, connSend) {
     if(err)
	{
		logger.error({ fs: 'MQSendResponse.js ', func: 'sendResponse' }," [sendResponse] Error Connecting: "+ err);
		return false;
	}
    connSend.createChannel(function(err, chSend) {
     if(err)
        {
          throw new Error(" [x] Error Creating Channel: "+ err);
        }

    chSend.assertQueue(sendQueueName, {durable: false});
    chSend.sendToQueue(sendQueueName, new Buffer(JSON.stringify(Message)));
    logger.debug({ fs: 'MQSendResponse.js ', func: 'sendResponse' }," [x] Response Sent Successfully!!!'");
    setTimeout(function() { connSend.close();  }, 500);
  });
});

 return true;
}


exports.MQOut = MQOut;

