const Handlebars = require('handlebars');
const moment = require('moment');
const crypto = require('crypto')
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

Handlebars.registerHelper('EpochToHumanMS', function (value) {
  value = parseInt(value) || 0;
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
    try {
        for (key in payload) {
            if (typeof payload[key] == "string" && payload[key].indexOf("{") > -1) {
                try {
                    payload[key] = JSON.parse(value);
                } catch (ex) {
                    console.log(ex)
                    payload[key] = value;
                }
            }
        }
    } catch (ex) {
        console.log(ex)
        console.log("release patched for to stringify object failed!!!, continue exec..");

    }
    let data = {};
    if (source.customFunction !== undefined) {
        source.customFunction.map((item) => {
            Handlebars.registerHelper(item.name, item.function);
        })
    }

    Handlebars.registerHelper("hashItems", function(otp) {
        return crypto.createHash('md5').update(otp).digest("hex")
      
      });
      
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