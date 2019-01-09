'use strict';
const config = global.config;
const logger = require('../logger');
const events = require('events').EventEmitter;
const emitter = new events.EventEmitter();
const BAL = require('../BAL');

emitter.on('processMessage', function (eventData) {

    if (typeof eventData === 'object' && Array.isArray(eventData) === false) {
        BAL.fetchData(config.eventService.EventListURL, {}).then((data) => {
            console.log("-----------Event Received GOT MESSAGE--------\n" + JSON.stringify(eventData, null, 2));
            data.forEach(tupple => {
                if (eventApplyRule(eventData, tupple.rule)) {       
                    console.log("Event Name: " + tupple.eventName);
                    BAL.dispatcher.insertDispatchRequest(createDispatchRequest(eventData,tupple));
                    console.log("event ready for dispatch");
                } else {
                    console.log("ignoring event due to Criterions failure");
                }
            })
        });


    } else {
        console.log("Ignoring Invalid Event Data!!");
    }
});

function createDispatchRequest(eventDataReceived, eventConfig) {
    let requests = [];
    eventConfig.dipatcher.forEach(tupple => {
        requests.push({
            sourceEvent: eventConfig.eventName,
            eventData: eventDataReceived,
            dispatcher: tupple,
            datasource: eventConfig.dataSource[0]
        })
    })
    return requests;
}

function eventApplyRule(data, rules) {
    let rulePass = 0;
    let ruleFail = 0;
    rules.forEach(rule => {
        let value = rule.value === "true" ? true : rule.value === "false" ? false : rule.value;

        switch (rule.type) {
            case "boolean":
                value = rule.value === "true" ? true : rule.value === "false";
                break;
            case "float":
                value = parseFloat(rule.value);
                break;
            case "integer":
                value = parseInt(rule.value);
                break;
            default:
                value = rule.value;
                break;
        }

        switch (rule.operator) {
            case "==":
                if (resolve(rule.field, data) == value)
                    rulePass++;
                break;
            case ">=":
                if (resolve(rule.field, data) >= value)
                    rulePass++;
                break;
            case "<=":
                if (resolve(rule.field, data) <= value)
                    rulePass++;
                break;
            case ">":
                if (resolve(rule.field, data) > value)
                    rulePass++;
                break;
            case "<":
                if (resolve(rule.field, data) < value)
                    rulePass++;

                break;
            default:
                console.log("invalid Operator Found!!")
                break;
        }
    });

    if (rulePass == rules.length)
        return true;
    else
        return false


}


function resolve(path, obj) {

    return path.split('.').reduce(function (prev, curr) {
        return prev ? prev[curr] : null
    }, obj || self)
}



const trigger = (data) => {
    emitter.emit('processMessage', data);
}
exports.trigger = trigger;


