'use strict';

const logger = require('../logger');
var config = require('../config.json');
var helper = require('../IntegrationLayer/helper.js');
var channels = require('../IntegrationLayer/create-channel.js');
var join = require('../IntegrationLayer/join-channel.js');
var install = require('../IntegrationLayer/install-chaincode.js');
var instantiate = require('../IntegrationLayer/instantiate-chaincode.js');
var invoke = require('../IntegrationLayer/invoke-transaction.js');
var query = require('../IntegrationLayer/query.js');

var getErrorMessage = function (field) {
        var response = {
                success: false,
                message: field + ' field is missing or Invalid in the request'
        };
        return response;
}

var getChannels = function (Responsecallback,GRPCCallback,trnxPayLoad){

	logger.debug({ fs: 'APICore.js ', func: 'getChannels' },'================ GET CHANNELS ======================');
	logger.debug({ fs: 'APICore.js ', func: 'getChannels' },'peer: ' + peerName);
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var peer = trnxPayLoad.Body.peerID;
	var error='';
	if (!peer) {
		error+= '\'peer\' ';
	}
	
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	query.getChannels(peer, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});

}

var getInstalledChaincodes = function (Responsecallback,GRPCCallback,trnxPayLoad){
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var peer = trnxPayLoad.Body.peerID;
	var installType = trnxPayLoad.Body.queryType;
    var error='';
	if (installType === 'installed') {
		logger.debug({ fs: 'MQListener.js ', func: 'getInstalledChaincodes' },'================ GET INSTALLED CHAINCODES ======================');
	} else {
		logger.debug({ fs: 'APICore.js ', func: 'getInstalledChaincodes' },'================ GET INSTANTIATED CHAINCODES ======================');
	}
	
	if (!installType) {
		error+= '\'installType\' ';
	}
    if (!peer) {
		error+= '\'peer\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	query.getInstalledChaincodes(peer, installType, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});
}

var getChainInfo = function (Responsecallback,GRPCCallback,trnxPayLoad){
	
	logger.debug({ fs: 'APICore.js ', func: 'getChainInfo' },'================ GET CHANNEL INFORMATION ======================');
	logger.debug({ fs: 'APICore.js ', func: 'getChainInfo' },'channelName : ' + req.params.channelName);
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	let peer = trnxPayLoad.Body.peerID;

	var error='';
	if (!peer) {
		error+= '\'peer\' ';
	}
	
	if (!username) {
		error+= '\'orgname\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	query.getChainInfo(peer, username, orgname).then(
		function(message) {
			Responsecallback(trnxPayLoad,message,GRPCCallback);
		});
}

var getBlockByHash = function (Responsecallback,GRPCCallback,trnxPayLoad){

	logger.debug({ fs: 'APICore.js ', func: 'getBlockByHash' },'================ GET BLOCK BY HASH ======================');
	logger.debug({ fs: 'APICore.js ', func: 'getBlockByHash' },'channelName : ' + req.params.channelName);
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	let hash = trnxPayLoad.Body.hashstring;
	let peer = trnxPayLoad.Body.peerID;
	var error='';
	if (!hash) {
		error+= '\'hash\' ';
	}
	if (!peer) {
		error+= '\'Peer ID\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}

	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	query.getBlockByHash(peer, hash, username, orgname).then(
		function(message) {
			Responsecallback(trnxPayLoad,message,GRPCCallback);
		});
}

var getTransactionByID = function (Responsecallback,GRPCCallback,trnxPayLoad){

logger.debug({ fs: 'APICore.js ', func: 'getTransactionByID' },'================ GET TRANSACTION BY TRANSACTION_ID ======================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	let trxnId = trnxPayLoad.Body.txID;
	let peer = trnxPayLoad.Body.peerID;
	var error='';
	if (!trxnId) {
		error+= '\'trxnId\' ';
	}
	if (!peer) {
		error+= '\'Peer ID \' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	query.getTransactionByID(peer, trxnId, username, orgname)
		.then(function(message) {
			Responsecallback(trnxPayLoad,message,GRPCCallback);
	});
}

var getBlockByNumber = function (Responsecallback,GRPCCallback,trnxPayLoad){
	
	logger.debug({ fs: 'APICore.js ', func: 'getBlockByNumber' },'==================== GET BLOCK BY NUMBER ==================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	let blockId = trnxPayLoad.Body.blkID;
	let peer = trnxPayLoad.Body.peerID;
	logger.debug({ fs: 'APICore.js ', func: 'getBlockByNumber' },{ fs: 'APICore.js ', func: 'getBlockByNumber' },'channelName : ' + cName);
	logger.debug({ fs: 'APICore.js ', func: 'getBlockByNumber' },'BlockID : ' + blockId);
	logger.debug({ fs: 'APICore.js ', func: 'getBlockByNumber' },'Peer : ' + peer);
	var error='';
	if (!blockId) {
		error+= '\'blockId\' ';
	}
	if (!peer) {
		error+= '\'peer\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	query.getBlockByNumber(peer, blockId, username, orgname)
		.then(function(message) {
			Responsecallback(trnxPayLoad,message,GRPCCallback);
		});
}

var queryChaincode = function (Responsecallback,GRPCCallback,trnxPayLoad){

	logger.debug({ fs: 'APICore.js ', func: 'queryChaincode' },'==================== QUERY BY CHAINCODE ==================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var channelName = trnxPayLoad.Body.channelName;
	var chaincodeName = trnxPayLoad.Body.SmartContractName;
	let args = trnxPayLoad.Body.arguments;
	let fcn = trnxPayLoad.Body.fcnName;
	let peer = trnxPayLoad.Body.peerListQuery;

	logger.debug({ fs: 'APICore.js ', func: 'queryChaincode' },'channelName : ' + channelName);
	logger.debug({ fs: 'APICore.js ', func: 'queryChaincode' },'chaincodeName : ' + chaincodeName);
	logger.debug({ fs: 'APICore.js ', func: 'queryChaincode' },'fcn : ' + fcn);
	logger.debug({ fs: 'APICore.js ', func: 'queryChaincode' },'args : ' + args);
    var error='';
	if (!chaincodeName) {
		error+= '\'chaincodeName\' ';
	}
	if (!channelName) {
		error+= '\'channelName\' ';
	}
	if (!fcn) {
		error+= '\'fcn\' ';
	}
	if (!args) {
		error+= '\'args\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	//args = args.replace(/'/g, '"');
	//args = JSON.parse(args);
	//logger.debug(args);

	query.queryChaincode(peer, channelName, chaincodeName, args, fcn, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});


}

var invokeChaincode = function (Responsecallback,GRPCCallback,trnxPayLoad){

	logger.debug({ fs: 'APICore.js ', func: 'invokeChaincode' },'==================== INVOKE ON CHAINCODE ==================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var peers = trnxPayLoad.Body.peerListInvoke;
	var chaincodeName = trnxPayLoad.Body.SmartContractName;
	var channelName = trnxPayLoad.Body.channelName;
	var fcn = trnxPayLoad.Body.fcnName;
	var args = trnxPayLoad.Body.arguments;
	logger.debug({ fs: 'APICore.js ', func: 'invokeChaincode' },'channelName  : ' + channelName);
	logger.debug({ fs: 'APICore.js ', func: 'invokeChaincode' },'chaincodeName : ' + chaincodeName);
	logger.debug({ fs: 'APICore.js ', func: 'invokeChaincode' },'fcn  : ' + fcn);
	logger.debug({ fs: 'APICore.js ', func: 'invokeChaincode' },'args  : ' + args);
	var error='';
	if (!peers || peers.length == 0) {
		error+= '\'peers\' ';
	}
	if (!chaincodeName) {
		error+= '\'chaincodeName\' ';
	}
	if (!channelName) {
		error+= '\'channelName\' ';
	}
	if (!fcn) {
		error+= '\'fcn\' ';
	}
	if (!args) {
		error+= '\'args\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});
}

var instantiateChaincode = function (Responsecallback,GRPCCallback,trnxPayLoad){

	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'==================== INSTANTIATE CHAINCODE ==================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var chaincodeName = trnxPayLoad.Body.SmartContractName;
	var chaincodeVersion = trnxPayLoad.Body.SmartContractVersion;
	var channelName = trnxPayLoad.Body.channelName;
	var functionName = trnxPayLoad.Body.fcnName;
	var args = trnxPayLoad.Body.arguments;
	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'channelName  : ' + channelName);
	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'chaincodeName : ' + chaincodeName);
	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'chaincodeVersion  : ' + chaincodeVersion);
	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'functionName  : ' + functionName);
	logger.debug({ fs: 'APICore.js ', func: 'instantiateChaincode' },'args  : ' + args);
	var error='';
	if (!chaincodeName) {
		error+= '\'chaincodeName\' ';
	}
	if (!chaincodeVersion) {
		error+= '\'chaincodeVersion\' ';
	}
	if (!channelName) {
		error+= '\'channelName\' ';
	}
	if (!functionName) {
		error+= '\'functionName\' ';
	}
	if (!args) {
		error+= '\'args\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	instantiate.instantiateChaincode(channelName, chaincodeName, chaincodeVersion, functionName, args, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});


}

var installChaincode = function (Responsecallback,GRPCCallback,trnxPayLoad){

logger.debug({ fs: 'APICore.js ', func: 'installChaincode' },'==================== INSTALL CHAINCODE ==================');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var peers = trnxPayLoad.Body.peerListInstallSC;
	var chaincodeName = trnxPayLoad.Body.SmartContractName;
	var chaincodePath =trnxPayLoad.Body.SmartContractPath;
	var chaincodeVersion = trnxPayLoad.Body.SmartContractVersion;
	
	logger.debug({ fs: 'APICore.js ', func: 'installChaincode' },'peers : ' + peers); // target peers list
	logger.debug({ fs: 'APICore.js ', func: 'installChaincode' },'chaincodeName : ' + chaincodeName);
	logger.debug({ fs: 'APICore.js ', func: 'installChaincode' },'chaincodePath  : ' + chaincodePath);
	logger.debug({ fs: 'APICore.js ', func: 'installChaincode' },'chaincodeVersion  : ' + chaincodeVersion);
	
	var error='';
	if (!peers || peers.length == 0) {
		error+= '\'Peer List\' ';
	}
	if (!chaincodeName) {
		error+= '\'chaincodeName\' ';
	}
	if (!chaincodePath) {
		error+= '\'chaincodePath\' ';
	}
	if (!chaincodeVersion) {
		error+= '\'chaincodeVersion\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});
}

var joinChannel = function (Responsecallback,GRPCCallback,trnxPayLoad){

logger.info({ fs: 'MQListener.js ', func: 'joinChannel' },'<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var channelName = trnxPayLoad.Body.channelName;
	var peers = trnxPayLoad.Body.peerListJoinChannel;
	logger.debug({ fs: 'MQListener.js ', func: 'joinChannel' },'channelName : ' + channelName);
	logger.debug({ fs: 'MQListener.js ', func: 'joinChannel' },'peers : ' + peers);
	var error='';
	if (!channelName) {
		error+= '\'channelName\' ';
	}
	if (!peers || peers.length == 0) {
		error+= '\'peers\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	
	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	join.joinChannel(channelName, peers, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});

}

var createChannel = function (Responsecallback,GRPCCallback,trnxPayLoad) {
    logger.info({ fs: 'MQListener.js ', func: 'createChannel' },'<<<<<<<<<<<<<<<<< C R E A T E I N G  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug({ fs: 'MQListener.js ', func: 'createChannel' },'End point : /channels');
	var username = trnxPayLoad.Header.UserID;
	var orgname = trnxPayLoad.Header.Org;
	var channelName = trnxPayLoad.Body.channelName;
	var channelConfigPath = trnxPayLoad.Body.channelConfigPath;
	logger.debug({ fs: 'MQListener.js ', func: 'createChannel' },'Channel name : ' + channelName);
	logger.debug({ fs: 'MQListener.js ', func: 'createChannel' },'channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	
	var error='';
	if (!channelName) {
		error+= '\'channelName\' ';
	}
	if (!username) {
		error+= '\'username\' ';
	}
	
	if (!orgname) {
		error+= '\'orgname\' ';
	}
	if (!channelConfigPath) {
		error+= '\'channelConfigPath\' ';
	}

	if(error!=='')
	{
		var result = getErrorMessage(error);
		Responsecallback(trnxPayLoad,result,GRPCCallback);
		return false;
	}
	
	channels.createChannel(channelName, channelConfigPath, username, orgname)
	.then(function(message) {
		Responsecallback(trnxPayLoad,message,GRPCCallback);
	});
}


exports.getErrorMessage = getErrorMessage;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
exports.getBlockByHash = getBlockByHash;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByNumber = getBlockByNumber;
exports.queryChaincode = queryChaincode;
exports.invokeChaincode = invokeChaincode;
exports.installChaincode = installChaincode;
exports.instantiateChaincode = instantiateChaincode;

exports.joinChannel = joinChannel;
exports.createChannel = createChannel;



