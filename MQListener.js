'use strict';

const dbConfig = require('./dbConfig');

global.config = {};

try {
  dbConfig.get(function(err, response, body) {
    if (!err) {
      global.config = body;
      require('./server');
    }
    else {
      console.log({ fs: 'app.js', func: 'init', error: err.stack || err }, 'server not started');
    }
  });
}
catch (err) {
  const error = err.stack || err;
  console.log({ fs: 'app.js', func: 'init' }, 'server not started ' + error);
}

