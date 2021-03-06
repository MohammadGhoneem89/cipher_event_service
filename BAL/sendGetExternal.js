let rp = require('request-promise');
let Config = global.config.eventService;
const logger = require('../logger');
const Endpoint = require('./endpoint');
let internal = (obj, body) => {
    let url = global.config.eventService.ISC_URL;
    obj.endpointName.address = `${obj.endpointName.address}${obj.requestURL === '/' ? "" : obj.requestURL}`;
    console.log("ADDRESS====================>", obj.endpointName.address);
    console.log("INTERNAL URL=============>", url, body);
    let rpOptions = {
        method: 'POST',
        url,
        body: {
            header: Config.Avanza_ISC,
            template: obj.templateName,
            endpoint: obj.endpointName,
            eventData: body
        },
        json: true,
        timeout: Config.timeout || 600000 // 10 min.
    };
    logger.info({ fs: 'RequestPromise', func: 'requestPromise' }, "[EPS][RP][SEND]", url, JSON.stringify(rpOptions.body || rpOptions));
    return rp(rpOptions);
};


let external = (obj, body) => {
    let _endpoint = new Endpoint(body);
    return _endpoint.executeEndpoint(obj.endpointName, obj.requestURL).then((resp) => {
        if (resp) {
            if (resp.success === false || resp.error === true) {
                throw new Error(resp.message);
            }
            return resp.data;
        }
        return resp;
    })
};
module.exports = {
    internal, external
};