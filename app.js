'use strict';
const dbConfig = require('./dbConfig');

global.config = {};

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
