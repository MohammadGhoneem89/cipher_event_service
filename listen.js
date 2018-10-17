const { fork } = require('child_process');
const fs = require('fs');


const threadStart = (config) => {
    const eHub = require('./services').eventHub;
    const BAL = require('./BAL');
    const postgress = require('./DAL/connect');
    postgress.connect(() => {
        BAL.fetchData(config.eventService.DataSourceURL, {}).then((data) => {
            data.forEach(element => {
                let filePath = element.filePath;
                if (fs.existsSync(filePath)) {
                    const process = fork(filePath);
                    if (process) {
                        process.send(global.config);
                        process.on(element.sourceFunction, evnt => {
                            eHub.trigger(evnt);
                        });
                    }
                } else {
                    console.log("Data source file defined not found!!!!");
                    console.log("Location: " + filePath);
                    console.log("Datasource Name: " + element.dataSourceName);
                }
            });
        })
    });
};


process.on('message', (params) => {
    global.config = params
    threadStart(params);
    process.send(0);
});