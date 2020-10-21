'use strict';
const pg = require('../api/connectors/postgress');
const config = global.config;
const logger = require('../logger');




let executrScalar = function (query, params, targetChannel, key) {
  return pg.connection().then((conn) => {
   console.log('Success Operation on Row Baring ID ' + JSON.stringify(key));
    return conn.query(query, params);
  });
}


let executeDataSet = function (query, params, targetChannel, key) {
  return pg.connection().then((conn) => {
    console.log('Success Operation on Row Baring ID ' + JSON.stringify(key));
     return conn.query(query, params);
   });
}

exports.executrScalar = executrScalar;
exports.executeDataSet = executeDataSet;