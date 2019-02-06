const fs = require('fs');
const _ = require('lodash');
const transformTemplate = require('./services/helperTransform');
let timer;
const start = (config) => {
    const pg = require('./api/connectors/postgress');
    pg.connection().then((conn) => {
        clearTimeout(timer);
        startDispatcher();
    });
};

function startDispatcher() {
    timer = setTimeout(() => {
        processDispatchQueue();
        startDispatcher();
    }, global.config.eventService.QueryInterval);
}

function processDispatchQueue() {
    const config = global.config.eventService
    const BAL = require('./BAL');
    let error = '';
    BAL.dispatcher.getPendingDispatchRequest().then((requests) => {

        requests.forEach(element => {
            let result = undefined, response = undefined, data = undefined;
            switch (element.dispatcher.type) {

                case "CUSTOM":
                    if (fs.existsSync(element.dispatcher.filePath)) {
                        try {
                            const dynoDispatcher = require("./" + element.dispatcher.filePath);
                            dynoDispatcher[element.dispatcher.dispatchFunction](element.eventdata).then(() => {
                                error = 'Successfully Dispatched!'
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error, {});
                            }).catch((exp) => {
                                console.log(exp);
                                error = exp.message ? exp.message : exp
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                            });
                        } catch (err) {
                            console.log(err);
                            error = err.message ? err.message : err
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                        }
                    } else {
                        console.log('dispatcher file defined not found!!!!');
                        console.log('Location: ' + element.dispatcher.filePath);
                        error = 'dispatcher file defined not found!!!!'
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                    }

                    break;
                case "API Direct":
                    console.log(element.dispatcher.templateName._id)
                    if (element.dispatcher.templateName && element.dispatcher.templateName._id)
                        result = transformTemplate(element.eventdata, element.dispatcher.templateName)
                    else
                        result = element.eventdata


                    let returnVal = {
                        header: {
                            username: element.dispatcher.endpointName.auth.username,
                            password: element.dispatcher.endpointName.auth.password
                        },
                        body: result
                    };
                    console.log(`API body: ${JSON.stringify(returnVal, null, 2)}`);
                    BAL.sendGet.external(element.dispatcher, returnVal).then((data) => {
                        if (data.errorCode && data.errorCode != "200") {
                            console.log(JSON.stringify(data));
                            returnVal.header && _.set(returnVal, 'header.password', "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                            response = {
                                request: returnVal,
                                response: data,
                            };
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, "some error occoured, please check logs!", response || {});
                        } else {
                            error = 'Successfully Dispatched!'
                            returnVal.header && _.set(returnVal, 'header.password', "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                            response = {
                                request: returnVal,
                                response: data,
                            };
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error, response || {});
                        }
                    }).catch((exp) => {
                        console.log(exp);
                        error = exp.message ? exp.message : exp;
                        let expRequest = {
                            header: {
                                username: element.dispatcher.endpointName.auth.username,
                                password: element.dispatcher.endpointName.auth.password
                            },
                            body: result
                        };
                        expRequest.header && _.set(expRequest, 'header.password', "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
                        response = {
                            request: expRequest,
                            response: data,
                            error: exp
                        };
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, response);
                    });
                    break;
                case "API In-Direct":
                    result = element.eventdata;
                    console.log("========element=========>",element,"<=======element===========");
                    // console.log(`API body: ${JSON.stringify(result, null, 2)}`);
                    BAL.sendGet.internal(element.dispatcher, result).then((data) => {
                        if (data && data.error === true) {
                          console.log("========RESPONSE=========>",data,"<=======RESPONSE===========");
                            // console.log(JSON.stringify(data));
                            response = {
                                request: data.request,
                                response: data.response,
                            };
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, data.message || "some error occoured, please check logs!", response || {});
                        } else {
                            error = 'Successfully Dispatched!'
                            response = {
                              request: data.request || result,
                              response: data.response,
                            };
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 1, data.message || error, response || {});
                        }
                    }).catch((exp) => {
                        console.log(exp);
                        error = exp.message ? exp.message : exp
                        response = {
                            request: result,
                            response: data,
                            error: exp
                        }
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, response);
                    });
                    break;
                case "API":

                    if (element.dispatcher.requestURL) {
                        let prebody = {}
                        if (element.dispatcher.requestBody !== "") {
                            prebody = JSON.parse(element.dispatcher.requestBody)
                        }

                        let body = {
                            ...prebody,
                            eventData: element.eventdata
                        };
                        console.log(`API body: ${JSON.stringify(body, null, 2)}`);
                        BAL.fetchData(element.dispatcher.requestURL, body).then((data) => {
                            if (data && data.error === true) {
                                console.log(JSON.stringify(data));
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 3, data.message || "some error occoured, please check logs!", data.response || {});
                            } else {
                                error = 'Successfully Dispatched!'
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 1, data.message || error, data.response || {});
                            }
                        }).catch((exp) => {
                            console.log(exp);
                            error = exp.message ? exp.message : exp
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                        });

                    } else {
                        console.log("URL not defined for type API!!");
                        error = 'URL not defined for type API!!'
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                    }

                    break;
                case "EMAIL":

                    let Body = {
                        header: config.Avanza_ISC,
                        action: "notificationInsert",
                        data: {
                            text: `Request ID ${element.internalid} Dispatched of type EMAIL`,
                            action: config.DispatchQueueURL,
                            type: "ERROR",
                            params: "?params",
                            labelClass: "label label-sm label-primary",
                            createdBy: "System",
                            groupName: element.dispatcher.groupName,
                            isEmail: true,
                            templateParams: element.eventdata,
                            templateId: element.dispatcher.templateId
                        }
                    };
                    console.log(`email block: ${JSON.stringify(Body, null, 2)}`);
                    BAL.fetchData(config.EmailURL, Body).then((data) => {
                        if (data.success === true) {
                            console.log(`email block: ${JSON.stringify(data, null, 2)}`);
                            error = 'Successfully Dispatched!'
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error, {});
                        } else {
                            console.log(data.message);
                            error = data.message
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                        }
                    }).catch((exp) => {
                        console.log(exp);
                        error = exp.message ? exp.message : exp
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                    });
                    break;
                default:
                    console.log("invalid type of dispatcher!!");
                    error = 'invalid type of dispatcher!!'
                    BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error, {});
                    break;
            }
        });
    })
}
process.on('message', (config) => {
    global.config = config;
    start(config);
});
