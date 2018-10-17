'use strict';
const Pool = require('pg-pool');
const logger = require('../logger');
const config = global.config;
const configpg = {
    host: config.postgressqlConfig.host,
    user: config.postgressqlConfig.user,
    database: config.postgressqlConfig.database,
    password: config.postgressqlConfig.password,
    port: config.postgressqlConfig.port,
    idleTimeoutMillis: 30000
};

function connect(callback){
     if(!global.client){
                const pool = new Pool(configpg);
                    
                    pool.connect().then(client => {
                        global.connection=client;
                        console.log("Postgress Connection Acquired Successfully!!");
                        callback();
                    });
                    global.client={
                        query:function(query, args,respCallback){          
                                return global.connection.query(query, args).then(res => {
                                  //client.release();
                                  respCallback(null,res);
                                  return res;
                                }).catch((exp)=>{
                                    console.log(exp);
                                    process.exit(1)
                                  respCallback(exp,null);
                                });
                           
                        }
                    }
                    
    }
    
}




exports.connect = connect