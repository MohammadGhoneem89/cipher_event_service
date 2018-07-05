let open = require("amqplib");
let os = require('os');
let ifaces = os.networkInterfaces();
const RetryInterval = 10000;

module.exports = class HealthCheckHelper {
    constructor(type, INTERVAL, config) {
        this.type = type;
        this.containerId = os.hostname();
        this.config = config;
        this.ip = getIP();
        this.MQConnStr = "";
        this.ConnMQ = {};

        if (config.UserName && config.Password) {
            this.MQConnStr =
                "amqp://" +
                config.UserName +
                ":" +
                config.Password +
                "@" +
                config.CommAddress +
                ":" +
                config.CommPort;
        } else {
            this.MQConnStr = config
        }

        this.startSend();

        setInterval(() => {
            this.sendMessage();
        }, INTERVAL);
    }

    startSend() {
        let _this = this;
        _startSend();
        function _startSend() {
            return open
                .connect(_this.MQConnStr)
                .then(conn => {
                    conn.on('error', () => {
                        setTimeout(_startSend, RetryInterval);
                    });
                    return conn.createChannel();
                })
                .then(ch => {
                    _this.ConnMQ = ch;
                    console.log("HEALTH CHANNEL CREATED");
                })
                .catch(err => {
                    console.log("HEALTH ERROR", err);
                    return setTimeout(_startSend, RetryInterval);
                });
        }
    }

    reportProblem(problem, isResolved) {
        if (problem.length > 0) {
            this.problem = problem;
        } else {
            this.problem = undefined;
        }
    }

    problemResolved() {
        this.problem = undefined;
    }

    sendMessage() {
        const message = {
            header: {
                responseMQ: ["HEALTH_QUEUE"]
            },
            body: {
                identifier: this.type,
                containerId: this.containerId,
                dockerIP: this.ip,
                timestamp: Date.now(),
                health: "H",
                lastProblem: ''
            }
        };
        if (this.problem) {
            message.body.health = "U";
            message.body.lastProblem = this.problem;

        }

        this.MQSender(message)
            .catch(err => {
                console.log(err, "========>ERROR");
            });
    }

    // Publisher
    MQSender(message) {
        let header = message.header || message.Header;
        let responseMQ = header.responseMQ || header.ResponseMQ;
        let _this = this;
        return new Promise((resolve, reject) => {
            if (responseMQ.length > 0) {
                let queueName = responseMQ.pop();
                _this.ConnMQ.assertQueue(queueName, {durable: false})
                    .then(() => {
                        return sendToQueue(queueName);
                    })
                    .catch(err => {
                        this.startSend();
                        reject(err);
                    });
            } else {
                let err = new Error("Output Queue is empty");
                reject(err);
            }


            function sendToQueue(queueName) {
                // console.log("Message sent to queue: "+ queueName);
                return _this.ConnMQ.sendToQueue(queueName, new Buffer(JSON.stringify(message)), {},
                    (err, ok) => {
                        if (err !== null) reject(err);
                        else resolve("PROCESS REQUEST SENT");
                    }
                );
            }
        });
    }
};


function getIP() {
    let ip;
    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                //console.log(ifname + ':' + alias, iface.address);
            } else {
                // this interface has only one ipv4 adress
                if (ifname.indexOf('docker') !== -1)
                    ip = iface.address;
                //console.log(ifname, iface.address);
            }
            ++alias;
        });
    });

    return ip;
}