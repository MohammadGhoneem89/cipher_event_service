const amqp = require('./amqp');
const pg = require('./pg');

module.exports = {
    createClient: async function (type, connectionURL) {
        let client;
        switch (type) {

            case 'amqp':
                client = await amqp(connectionURL);
                break
            case 'pg':
                client = await pg(connectionURL);
                break;
        }
        return client;
    }
}