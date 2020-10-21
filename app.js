'use strict';
const dbConfig = require('./dbConfig');

const express = require('express');
let app = express();

global.config = {};


const serverStatus = async (callback) => {
    try {
	console.log('Global Error : ',global.error);
        if (global.error == null || global.error == "" || !global.error) {
            let pgOK = false; 
            let mqOK = false; 
            let pg = require('./api/connectors/postgress'); 
            let mq = require('./api/connectors/queue'); 
            if (await pg.checkConnection()) pgOK = true; if (await mq.checkConnection()) mqOK = true;
            if (pgOK && mqOK) callback({ state: 'healthy' }); else throw new Error();
        }
    } catch (error) {
        console.log(error); callback({ state: 'Unhealthy', error: global.error });
    }
};

app.use('/health', require('express-healthcheck')({
    test: serverStatus
}));

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
            setTimeout(function () {
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
