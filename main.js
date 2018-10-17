'use strict';
const config = global.config;
const logger = require('./logger');
const crypto = require('./crypto');
let MQConnStr = crypto.decrypt(config.amqp.url);
let BAL = require('./BAL')
const DAL = require('./DAL/connect');
const services = require('./services');
const { fork } = require('child_process');


let start = function () {

     
        const listen = fork('listen.js');
        listen.send(config);
        listen.on('message', err => {
          console.log("Listen Process Exited !!");
        });


        const dispatch = fork('dispatch.js');
        dispatch.send(config);
        dispatch.on('message', err => {
          console.log("Dispatch Process Exited !!");
        });
  
 
       
}

start();

exports.start = start;
