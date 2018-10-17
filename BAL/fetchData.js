let rp = require('request-promise');
let Config = global.config.eventService;
const logger = require('../logger');

let send = (url, body) => {
    let rpOptions = {
        method: 'POST',
        url,
        body: Object.assign({header: Config.Avanza_ISC},body),
        json: true 
    };
    logger.info({ fs: 'RequestPromise', func: 'requestPromise' }, "[EPS][RP][SEND]", url, JSON.stringify(rpOptions.body || rpOptions));
    return rp(rpOptions);
};

module.exports = send;