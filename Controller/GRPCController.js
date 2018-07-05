'use strict';

const logger = require('../logger');
var config = global.config;
var Core = require('../Core/APICore.js');
var RSVP = require('rsvp');

var processTrnx = function (trnxId, trnxPayLoad,callback){
	
	switch(trnxId){
		
		case "0001": QueryChain(trnxPayLoad,callback);
			break;
		default:
		{
			var response = {
                success: false,
                message: 'Invalid TranCode'
			};
			
			logger.error({ fs: 'GRPCController.js ', func: 'processTrnx' },' [processTrnx] ended With Failure/Rejection!');
			logger.debug({ fs: 'GRPCController.js ', func: 'processTrnx' },' [processTrnx] Sending Error To Message Queue!!');
			var outMessage = CreateOutMessage(trnxPayLoad,response,false);
			callback(null,outMessage);
		}
		break;
		
	}
}



function QueryChain(trnxPayLoad,GRPCcallback){
			
			Core.queryChaincode(Querycallback,GRPCcallback,trnxPayLoad);
			
}


var Querycallback = function (trnxPayLoad,Result,GRPCcallback){
	
				if (Result.success==true) {
					logger.debug({ fs: 'GRPCController.js ', func: 'Querycallback' },' [Querycallback] query Chaincode Ended With Success!');
					var outMessage = CreateOutMessage(trnxPayLoad,Result);
					GRPCcallback(null,outMessage);
					logger.debug({ fs: 'GRPCController.js ', func: 'Querycallback' }," [Querycallback] Operation Completed Successfully For Message : " + trnxPayLoad.Header.UUID);
				} else {
					logger.error({ fs: 'GRPCController.js ', func: 'Querycallback' },' [Querycallback] '+Result.message);
					logger.error({ fs: 'GRPCController.js ', func: 'Querycallback' },' [Querycallback] query Chaincode Ended With Failure/Rejection!');
					var outMessage = CreateOutMessage(trnxPayLoad,Result);
					GRPCcallback(null,outMessage);
				}
}

//STUB: for out Message formulation
function CreateOutMessage(trnxPayLoad,msg){
	
	trnxPayLoad.Header.TranType="0210";
	trnxPayLoad.Body={};
	trnxPayLoad.Body.success=msg.success;
	trnxPayLoad.Body.result=msg.message;
	
	
	var FormattedMessage = JSON.stringify(trnxPayLoad, null, 2);
	logger.debug({ fs: 'GRPCController.js ', func: 'CreateOutMessage' }," [x] Sending Message Back to Caller!!! \n"+FormattedMessage);
	
	return trnxPayLoad;
}

exports.processTrnx = processTrnx
