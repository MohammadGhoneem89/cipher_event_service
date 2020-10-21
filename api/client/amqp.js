const amqplib = require('amqplib');
const crypto = require('crypto');
var AMQPExistingList = {};

module.exports = async function (connectionURL) {
    const hash = crypto.createHash('md5').update(connectionURL).digest("hex");
    const createConnection = async () => {
        const conn = await amqplib.connect(connectionURL);
        conn.on("close", function () {
            console.error("[AMQP] reconnecting");
            return setTimeout(createConnection, 7000);
        });
        let channel = await conn.createChannel();
        AMQPExistingList[hash] = channel;
        return channel;
    };

    if (AMQPExistingList[hash]) {
        console.log('Returning a MQ instance');
    } else {
        console.log('Creating a MQ instance');
        try {
            await createConnection();
        } catch (err) {
            console.log(err);
            setTimeout(createConnection, 7000);
        }
    }
    return AMQPExistingList[hash];
};