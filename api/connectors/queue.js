'use strict';
const config = require('../../../config/index');
const factory = require('../client/index');
const crypto = require('../../../lib/helpers/crypto');

let mqConnection = crypto.decrypt(config.get('amqp.url'));

function _start() {
  return factory.createClient('amqp', mqConnection);
}

module.exports = {
  start: _start
};
