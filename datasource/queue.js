'use strict';

const amq = require('./client/amqp');
const crypto = require('../crypto');

function consume(connectionstring, queueName) {
   var  channelwrapper= amq(connectionstring,queueName,false)
  
   channelwrapper.addSetup(setupFn, err => {
        if(err) {console.log("Error adding setup function");}
    });
        console.log(`[*] Connection Aquired: ${connectionstring}`);

           //function
           function setupFn(channel, done) {
                    channel.consume(queueName, function (msg) {
                        console.log(`[*] Waiting for messages ${queueName}`);
                        let event = undefined;
                        try { event = JSON.parse(msg.content.toString()) }
                        catch (ex) {console.log(`message discarded due bad JSON from Queue  ${queueName}`) }
                        if (event) {
                            console.log(`----- Got EVENT -------\n${JSON.stringify(event, null, 2)}`)
                            process.send(event)
                        };
                        channel.ack(msg);
                    }, done);
                }

                
        
}



process.once('message', (arg) => {
    global.config = arg.config;
    let connectionstring = crypto.decrypt(arg.config.amqp.url);
    consume(connectionstring, arg.datasourceConfig.queueName);
});