const amqplib = require('amqp-connection-manager');
const crypto = require('crypto');
var AMQPExistingList = {};

module.exports =  function (connectionURL,rxQueueName,isDurable) {
    const hash = crypto.createHash('md5').update(connectionURL).digest("hex");
   

    if (AMQPExistingList[hash] && AMQPExistingList[hash].isConnected() ) {
        console.log('Returning a MQ instance');
        return AMQPExistingList[hash];
    } else {
        console.log('Creating a MQ instance');
        try {
          
                const conn =  amqplib.connect([connectionURL]);
                conn.on("close", function () {
                    console.error("[AMQP] reconnecting");
                    return setTimeout(createConnection, 7000);
                });
                let channelWrapper  =  conn.createChannel({
                    json: true,
                    setup: function(channel) {
                        // `channel` here is a regular amqplib `ConfirmChannel`.
                        // Note that `this` here is the channelWrapper instance.
                        // return channel.assertQueue(rxQueueName, {durable: isDurable});
                    }
                });
                console.log("channel wrapper "+channelWrapper)
                AMQPExistingList[hash] = channelWrapper;
                return channelWrapper;
            
        } catch (err) {
            console.log(err);
            setTimeout(createConnection, 7000);
        }
    }
    return AMQPExistingList[hash];
};