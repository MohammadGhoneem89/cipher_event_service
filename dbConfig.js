'use strict';

const request = require('request');
const config = require('./config/config.json');
const secret = require('./secret')

function get(callback) {
  const options = {
    method: 'POST',
    url: config.applySecrets ? secret.get("VAULT-URL" + "-" + config.appName) : config.keyVault.url,
    body: {
      env: config.keyVault.env,
      header: config.applySecrets ? {
        "username": secret.get("VAULT-USERNAME" + "-" + config.appName),
        "password": secret.get("VAULT-PASSWORD" + "-" + config.appName)
      }
        : config.keyVault.header
    },
    json: true
  };


  request(options, callback);
}

module.exports = {
  get: get
};
