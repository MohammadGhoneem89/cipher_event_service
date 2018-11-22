'use strict';
const amqp = require('amqplib/callback_api');
const remedy = require('amqplib-auto-recovery');
const crypto = require('../crypto');
function consume(connectionstring, queueName) {
    remedy(amqp, {
        onError: (err) => { console.log(err.message) },
        isErrorUnrecoverable: (err) => false
    }).connect(connectionstring, function (err, connection) {
        if (err) {
            console.log(" [AMQP] ", err.message);
            return;
        }
        console.log(`[*] Connection Aquired: ${connectionstring}`);
        connection.createChannel(function (err, channel) {
            channel.assertQueue(queueName, {
                durable: false
            });
            channel.prefetch(1);
            console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queueName);
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
            }, { noAck: false });
        });
    });
}


process.once('message', (arg) => {
    global.config = arg.config;
    let connectionstring = crypto.decrypt(arg.config.amqp.url);
    consume(connectionstring, arg.datasourceConfig.queueName);
});