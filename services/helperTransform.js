const Handlebars = require('handlebars');
const moment = require('moment');
/**
 * Allows to bind payload data to templates
 * @param {String} id : _id of the API template mongo record
 * @param {JSON} payload : The payload to be passed for binding
 * @returns {JSON} {err: Error, data: ParsedData}
 */
Handlebars.registerHelper('EpochToHuman', function (value) {
    value = parseInt(value) || 0;
    value *= 1000;
    return moment(value).format('DD/MM/YYYY');
});
Handlebars.registerHelper('getzero', function (value) {
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> HELPER ", JSON.stringify(value))
    return value[0] || "";
});
Handlebars.registerHelper('jsonParse', function (value) {
    try {
        return JSON.parse(value);
    } catch (ex) {
        return value;
    }
});
Handlebars.registerHelper('test', function (value) {
    return value;
});

function transformTemplate(payload, source) {
    let data = {};
    if (source.customFunction !== undefined) {
        source.customFunction.map((item) => {
            Handlebars.registerHelper(item.name, item.function);
        })
    }
    try {
        source = source.data;
        let template = Handlebars.compile(JSON.stringify(source));
        data = template(payload);
    } catch (err) {
        console.log('Conversion error', err);
    }
    try {
        data = JSON.parse(data);
    } catch (err) {
        //console.log('JSON conversion err', err);
    }
    return data;
}

module.exports = transformTemplate;