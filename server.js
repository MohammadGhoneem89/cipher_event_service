'use strict';
const express = require('express');
let app = express();
const dbConfig = require('./dbConfig');

global.config = {};

tryConnection();

const serverStatus = async (callback) => {


  if(global.error==null || global.error=="")
  callback({ state: 'healthy' });
  else 
  callback({ state: 'Unhealthy',error:global.error });
    
      
  };
  
  var appServer = app.listen(9950, function () {
    
    console.log('server running at http://%s:%s\n', appServer.address().address, appServer.address().port);
  });
  
  app.use('/health', require('express-healthcheck')({
    test: serverStatus
  }));
  


function tryConnection() {
  getConfigs()
    .then((config) => {
      global.config = config;
      console.log({ fs: 'app.js', func: 'init' }, 'server started');
      const DAL = require('./DAL/connect');
      const services = require('./services');
      DAL.connect(() => {
        services.commission.createBatchRequests();
        services.settlement.createBatchRequests();
      });
    })
    .catch((err) => {
      console.log({ fs: 'app.js', func: 'init', error: err.stack || err }, 'server not started, will retry after one second');
      setTimeout(function () {
        return tryConnection();
      }, 7000);
    });
}

function getConfigs() {
  return new Promise((resolve, reject) => {
    dbConfig.get((err, response, body) => {
      if (!err && typeof body === 'object') {
        resolve(body);
      }
      err = err || body;
      reject(err);
    });
  });
}
