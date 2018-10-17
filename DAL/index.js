'use strict';
const pg = require('pg');
const config = global.config;
const logger = require('../logger');



let executrScalar = function(query, params,targetChannel,key){
   return new Promise(function(resolve, reject) {
     if(global.client){
        global.client.query(query,params, function (err, result) {
           if (err) {
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Error executing query ");
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Query:"+ query);
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Error:"+ err);
               process.exit(1);
           }
           logger.info({fs: 'server.js', func: 'executrScalar'}," | "+ 'Success Operation on Row Baring ID ' + JSON.stringify(key) );
           //console.log(' row inserted Successfully ' + JSON.stringify(key));
           resolve();
        });
        } else {
            console.log("DB Client is not initialized!!!");
            logger.error({fs: 'server.js', func: 'executrScalar'}," | Error: DB Client is not initialized!!!");
            process.exit(1);
        }
    });
  }


 let executeDataSet = function(query, params,targetChannel,key){
   return new Promise(function(resolve, reject) {
    if(global.client){
        global.client.query(query,params, function (err, result) {
           if (err) {
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Error fetch executing query ");
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Query:"+ query);
               logger.error({fs: 'server.js', func: 'executrScalar'}," | Error:"+ err);
               process.exit(1);
           }
           logger.info({fs: 'server.js', func: 'executrScalar'}," | "+ 'Fetch OP Row Baring ID ' + JSON.stringify(key) );
           resolve(result);
      });
    } else {
            console.log("DB Client is not initialized!!!");
            logger.error({fs: 'server.js', func: 'executrScalar'}," | Error: DB Client is not initialized!!!");
            process.exit(1);
    }
  });
}

  exports.executrScalar = executrScalar;
  exports.executeDataSet = executeDataSet;