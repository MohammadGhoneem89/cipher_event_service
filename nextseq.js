'use strict';
const logger = require('./logger');
const config = global.config;
let channel = config.privacyConfig;
const rp = require('request-promise');
const fs = require("fs");
const MQResponse = require('./IntegrationMQ/MQSendResponse.js');
const follow = require('follow');
var lastRestorePoint=-1
var IP = config.URLRestInterface;
const escapeJSON = require('escape-json-node');
const getUpsertURL= IP + 'APII/ePay/upsertPrivacyData'
const crypto = require('./crypto');
var HealthCheckHelper = require('./utils/health.js');
let rebbitURL=crypto.decrypt(config.amqp.url);
const {Store} = require("fs-json-store");
var jsonStore;
var Storage = require('node-storage');
const pg = require('pg');

const configpg = {
    host: config.postgressqlConfig.host,
    user: config.postgressqlConfig.user,
    database: config.postgressqlConfig.database,
    password: config.postgressqlConfig.password,
    port: config.postgressqlConfig.port
};
const pool = new pg.Pool(configpg);
const queryResult= "insert into trandump (epayrefnumber, tranxdata, \"createdOn\" ) values ( $1::varchar,$2::json,clock_timestamp()) on conflict (epayrefnumber) do update set (tranxdata, \"updatedOn\") = ($2::json, clock_timestamp()) where trandump.epayrefnumber = '$1::varchar' and trandump.\"createdOn\" < clock_timestamp()";

function LoadFollowingData(channel){
  let store = new Storage("persistance/"+channel.id + "STORE");
  let channeldata=store.get(channel.id);
    if(channeldata){
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>DATA Found!!");
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>Starting Sequence");
      console.log(channeldata.since);
      FollowChanges(channeldata,channel,store);
    } else {
      console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>DATA Not Found!!");
    }
}


function StartFollowing(){
  console.log( "Started Events with channels : "+ channel.length);
  logger.info({fs: 'server.js', func: 'StartFollowing'}, "Started Events with channels : "+ channel.length);
  let promises = [];
  for(let i=0;i<channel.length;i++){
      promises.push(LoadFollowingData(channel[i]));
  }

  return Promise.all(promises)
    .then((responses) => {
        console.log(JSON.stringify(responses))
    })
    .catch((err) => {
      logger.error({fs: 'server.js', func: 'StartFollowing'}, ' [ Transaction Search ] transaction Search error : '+ err.stack);
  });
}





function FollowChanges(lastSeqJSON,channel,store){
    findnextseqset(lastSeqJSON,channel,store).then((it1)=>{
        //console.log(it1);
        //process.exit(1);
        it1.success===true? console.log(it1.seek.since): FollowChanges(it1.seek,channel,store);
    });
   
}


function findnextseqset(lastSeqJSON,channel,store){
    console.log(channel.FeedFollowURL + channel.channelName+"/_changes?Last-Event-ID=10");
    let options = {
       method: 'GET',
       uri: channel.FeedFollowURL + channel.channelName+"/_changes?style=all_docs&feed=longpoll&limit=100&Last-Event-ID="+lastSeqJSON.since,
       json: true // Automatically stringifies the body to JSON
    };

   return rp(options)
       .then(function (parsedBody) {
            let flagRecurse = false
            console.log("LAST SEQ::::----->>>>"+parsedBody.last_seq);
            for(let row in parsedBody.results){
                flagRecurse = /^\d+$/.test(parsedBody.results[row].id);
                console.log(JSON.stringify(parsedBody.results[row].id));
            }
            let deepCopy={"id":"SDGsince","since":""};
            deepCopy.since=parsedBody.last_seq;
            let retData={
                success: flagRecurse,
                seek:deepCopy
            }
            return retData;
       })
       .catch(function (err) {
           logger.error({fs: 'server.js', func: 'upsert'}, err.stack);
           process.exit(1);
       }); 

}
   







StartFollowing();


