let rp = require('request-promise');
let Config = global.config.eventService;
const logger = require('../logger');

let internal = (obj, body) => {
    let url=Config.eventService.ISC_URL;
    let rpOptions = {
        method: 'POST',
        url,
        body: Object.assign({
            header: Config.Avanza_ISC,
            template: obj.templateName,
            endpoint: obj.endpointName
        }, body),
        json: true
    };
    logger.info({ fs: 'RequestPromise', func: 'requestPromise' }, "[EPS][RP][SEND]", url, JSON.stringify(rpOptions.body || rpOptions));
    return rp(rpOptions);
};
header:
{
  username: 'api_user',
  password: '2c4e9365c231754b208647854e1f608b8db6014d8a28c02a850162963f28ca5b'
},

let external = (obj, body) => {
    let url=`${obj.endpointName.address}${obj.requestURL == '/' ? "" : obj.requestURL}`
    let rpOptions = {
        method: 'POST',
        body: body,
        url,
        body: body,
        json: true
    };
    logger.info({ fs: 'RequestPromise', func: 'requestPromise' }, "[EPS][RP][SEND]", url, JSON.stringify(rpOptions.body || rpOptions));
    return rp(rpOptions);
};
module.exports = {
    internal, external
};