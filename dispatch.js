const fs = require('fs');
let timer;
const start = (config) => {
  const postgress = require('./DAL/connect');
    postgress.connect(() => {
        clearTimeout(timer);
        startDispatcher();
    });
};

function startDispatcher() {
    timer = setTimeout(() => {
        processDispatchQueue();
        startDispatcher();
    }, config.eventService.QueryInterval);
}

function processDispatchQueue() {
    const BAL = require('./BAL');
    let error = '';
    BAL.dispatcher.getPendingDispatchRequest().then((data) => {
        data.forEach(element => {
            switch (element.dispatcher.type) {
                case 'Custom':
                    if (fs.existsSync(element.dispatcher.filePath)) {
                        try {
                            const dynoDispatcher = require("./"+element.dispatcher.filePath);
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
                        console.log('Location: '+ element.dispatcher.filePath);
                        error = 'dispatcher file defined not found!!!!'
                        BAL.dispatcher.updateDispatchRequest(element.internalid, 3, error);
                    }
                    
                    break;
                case 'API':
                    if (element.requestURL) {
                        let body = {};
                        if (element.requestBody && typeof element.requestBody === 'object' && Array.isArray(eventData) === false) {
                            body = element.requestBody
                        }
                        BAL.fetchData.send(element.requestURL, body).then(() => {
                            error = 'Successfully Dispatched!'
                            BAL.dispatcher.updateDispatchRequest(element.internalid, 1, error);
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
