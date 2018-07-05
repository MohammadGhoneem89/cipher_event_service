'use strict';

const crypto = require('crypto');
const _ = require('lodash');

module.exports = {
  encrypt,
  decrypt
};

function encrypt(crypt = '') {
  crypt = _.isObject(crypt) ? JSON.stringify(crypt) : crypt;
  const cipher = crypto.createCipher('aes-256-ctr', global.config.cryptoTemp);
  return cipher.update(crypt, 'utf8', 'hex');
}

function decrypt(str = '') {
  const decipher = crypto.createDecipher('aes-256-ctr', global.config.cryptoTemp);
  const crypt = decipher.update(str, 'hex', 'utf8');
  try {
    return JSON.parse(crypt);
  }
  catch (err) {
    return crypt;
  }
}
