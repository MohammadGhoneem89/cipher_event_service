let rp = require('request-promise');
let Config = global.config.eventService;
const logger = require('../logger');

let internal = (obj, body) => {
    let url= global.config.eventService.ISC_URL;
    obj.endpointName.address = `${obj.endpointName.address}${obj.requestURL === '/' ? "" : obj.requestURL}`;
    console.log("ADDRESS====================>",obj.endpointName.address);
    console.log("INTERNAL URL=============>",url, body);
    let rpOptions = {
        method: 'POST',
        url,
        body: {
            header: Config.Avanza_ISC,
            template: obj.templateName,
            endpoint: obj.endpointName,
            eventData: body
        },
        json: true
    };
    logger.info({ fs: 'RequestPromise', func: 'requestPromise' }, "[EPS][RP][SEND]", url, JSON.stringify(rpOptions.body || rpOptions));
    return rp(rpOptions);
};


let external = (obj, body) => {
    let url=`${obj.endpointName.address}${obj.requestURL === '/' ? "" : obj.requestURL}`;
  console.log("URL=============>",url, body);
    let rpOptions = {
        method: 'POST',
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