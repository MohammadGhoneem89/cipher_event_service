'use strict';

const dbConfig = require('./dbConfig');

global.config = {};

tryConnection();

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
