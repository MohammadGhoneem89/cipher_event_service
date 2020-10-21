'use strict';
const factory = require('../client/index');
const crypto = require('../../crypto');
const config = global.config;
let dbConfig;
dbConfig = crypto.decrypt(config.postgres.url);
function _connection() {
    //dbConfig = crypto.decrypt(config.postgres.url);
    console.log("--------->>>>> 1 dbConfig " , JSON.stringify(dbConfig))
    return new Promise(async (resolve, reject) => {
        try {
            let pgConnection = await factory.createClient('pg', dbConfig);
            return resolve(pgConnection);
        } catch (e) {
            return reject(e);
        }
    });
};
async function _checkConnection() {
    try {
        console.log("--------->>>>> 2 dbConfig " , JSON.stringify(dbConfig))
        let conn = await factory.createClient('pg', dbConfig); return true;
    } catch (error) { console.log(error); global.error = error; return false; }
}

module.exports = {
    connection: _connection,
    checkConnection: _checkConnection
}