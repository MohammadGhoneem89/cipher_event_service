'use strict';
const dbConfig = require('./dbConfig');

const express = require('express');
let app = express();

global.config = {};


const serverStatus = async (callback) => {


  if(global.error==null || global.error=="")
  callback({ state: 'healthy' });
  else 
  callback({ state: 'Unhealthy',error:global.error });
    
      
  };
  
  var appServer = app.listen(9950, function () {
    
    console.log('server running at http://%s:%s\n', appServer.address().address, appServer.address().port);
  });
  


tryConnection();

function tryConnection() {
  getConfigs()
    .then((config) => {
      global.config = config;
      console.log({ fs: 'app.js', func: 'init' }, 'server started');
      require('./main.js');
      return Promise.resolve(config);
    })
    .catch((err) => {
      console.log({ fs: 'app.js', func: 'init', error: err.stack || err }, 'server not started, will retry after one second');
      setTimeout(function() {
        return tryConnection();
      }, 1000);
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
