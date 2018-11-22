'use strict';
const factory = require('../client/index');
const crypto = require('../../crypto');
const config = global.config;

module.exports.connection = function() {
  let dbConfig = crypto.decrypt(config.postgres.url);
  return new Promise(async (resolve, reject) => {
    try{
      let pgConnection = await factory.createClient('pg', dbConfig);
      return resolve(pgConnection);
    }
    catch (e) {
      return reject(e);
    }
  });
};
