const fs = require('fs');
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
    BAL.dispatcher.getPendingDispatchRequest().then((data) => {
        data.forEach(element => {
            switch (element.dispatcher.type) {
                case 'CUSTOM':
                    if (fs.existsSync(element.dispatcher.filePath)) {
                        try {
                            const dynoDispatcher = require("./" + element.dispatcher.filePath);
                            dynoDispatcher[element.dispatcher.dispatchFunction](element.eventdata).then(() => {
                                error = 'Successfully Dispatched!'
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error);
                            }).catch((exp) => {
                                console.log(exp);
                                error = exp.message ? exp.message : exp
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                            });
                        } catch (err) {
                            console.log(err);
                            error = err.message ? err.message : err
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                        }
                    } else {
                        console.log('dispatcher file defined not found!!!!');
                        console.log('Location: ' + element.dispatcher.filePath);
                        error = 'dispatcher file defined not found!!!!'
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                    }

                    break;
                case 'API':

                    if (element.dispatcher.requestURL) {
                        let prebody = {}
                        if (element.dispatcher.requestBody !== ""){
                            prebody=JSON.parse(element.dispatcher.requestBody)
                        }

                            let body = {
                                ...prebody,
                                eventData: element.eventdata
                            };
                        console.log(`API body: ${JSON.stringify(body, null, 2)}`);
                        BAL.fetchData(element.dispatcher.requestURL, body).then((data) => {
                            if(data && data.error===true){
                                 console.log(JSON.stringify(data));
                                 BAL.dispatcher.updateDispatchRequest(element.internalid, 3, data.message || "some error occoured, please check logs!");
                            } else {
                                error = 'Successfully Dispatched!'
                                BAL.dispatcher.updateDispatchRequest(element.internalid, 1, data.message || error);
                            }
                        }).catch((exp) => {
                            console.log(exp);
                            error = exp.message ? exp.message : exp
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                        });

                    } else {
                        console.log("URL not defined for type API!!");
                        error = 'URL not defined for type API!!'
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                    }

                    break;
                case 'EMAIL':

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
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error);
                        } else {
                            console.log(data.message);
                            error = data.message
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                        }
                    }).catch((exp) => {
                        console.log(exp);
                        error = exp.message ? exp.message : exp
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                    });
                    break;
                default:
                    console.log("invalid type of dispatcher!!");
                    error = 'invalid type of dispatcher!!'
                    BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                    break;
            }
        });
    })
}
process.on('message', (config) => {
    global.config = config;
    start(config);
});