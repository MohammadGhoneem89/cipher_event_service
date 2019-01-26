const { fork } = require('child_process');
const fs = require('fs');


const threadStart = (config) => {
    const eHub = require('./services').eventHub;
    const BAL = require('./BAL');
    const pg = require('./api/connectors/postgress');
    pg.connection().then((conn) => {
        console.log(config.eventService.DataSourceURL)
        BAL.fetchData(config.eventService.DataSourceURL, {}).then((data) => {
            data.forEach(element => {
                console.log(`data: ${JSON.stringify(element, null, 2)}`);
                if (element.type) {
                    switch (element.type) {
                        case 'queue':
                            console.log("starting consumer");
                            const process = fork('./datasource/queue.js');
                            if (process) {
                                let param = {
                                    config: config,
                                    datasourceConfig:element
                                }
                                process.send(param);
                                process.on('message', evnt => {
                                    eHub.trigger(evnt);
                                });
                            }
                            break;
                        default:
                            let filePath = element.filePath;
                            if (fs.existsSync(filePath)) {
                                const process = fork(filePath);
                                if (process) {
                                    process.send(config);
                                    process.on(element.sourceFunction, evnt => {
                                        eHub.trigger(evnt);
                                    });
                                }
                            } else {
                                console.log("Data source file defined not found!!!!");
                                console.log("Location: " + filePath);
                                console.log("Datasource Name: " + element.dataSourceName);
                            }
                            break;
                    }
                }

                /*
               
                */
            });
        })
    });
};


process.on('message', (params) => {
    global.config = params
    threadStart(params);
    process.send(0);
});