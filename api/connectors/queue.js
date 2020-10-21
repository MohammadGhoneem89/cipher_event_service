'use strict';
//const config = require('../../../config/index');
//const config = require('../../config/index');
const config = global.config;
const factory = require('../client/index');
//const crypto = require('../../../lib/helpers/crypto');
const crypto = require('../../crypto');

let mqConnection = crypto.decrypt(config.amqp.url);

function _start() {
    return factory.createClient('amqp', mqConnection);
}

async function _checkConnection() {
    try {
        let conn = await factory.createClient('amqp', mqConnection);
        return true;
    } catch (error) {
        console.log(error);
        global.error = error;
        return false;
    }
}
module.exports = {
    start: _start,
    checkConnection: _checkConnection
};
