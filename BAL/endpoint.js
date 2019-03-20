'use strict';
const _ = require('lodash');
const rp = require('request-promise');
const moment = require('moment');
const Base64 = require('js-base64').Base64;
let generalResponse = {
  "error": true,
  "message": "Failed to get response"
};
module.exports = class Endpoint {
  constructor(body) {
    this._requestBody = body;
  }
  executeEndpoint(endpoint, ServiceURI, ignoreBody) {
    let ServiceURL = "";
    let postfix = ServiceURI == '/' ? "" : ServiceURI;
    ServiceURL = `${endpoint.address}${postfix}`;
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ", ServiceURL);
    switch (endpoint.authType) {
      case "bearer":
        if (endpoint.auth.endpoint.auth.endpoint) {
          generalResponse.error = true;
          generalResponse.message = "Circualr JWT Request Cannot be Processed Please Check Endpoint!!";
          return Promise.resolve(generalResponse);
        };
        let tokenfield = _.get(endpoint, 'auth.field', undefined);
        if (!tokenfield) {
          generalResponse.error = true;
          generalResponse.message = "Token field not available Please Check Endpoint!!";
          return Promise.resolve(generalResponse);
        };
        return this.executeEndpoint(endpoint.auth.endpoint, "/", 1).then((data) => {
          let tokenValue = _.get(data, `data.${tokenfield}`, undefined);
          if (!tokenValue) {
            generalResponse.error = true;
            generalResponse.message = `Not able to fetch field from success authentication response | field : ${tokenfield}`;
            generalResponse.data = data;
            return Promise.resolve(generalResponse);
          }
          else if (data.error && data.error == true) {
            return Promise.resolve(data);
          }
          return this.executeBarerAuthEndpoint(endpoint, this._requestBody, ServiceURL, tokenValue).then((resp) => {
            if (resp.error === true) {
              return resp;
            }
            generalResponse.error = false;
            generalResponse.message = `Processed Ok!`;
            generalResponse.data = resp;
            return Promise.resolve(generalResponse);
          });
        }).catch((ex) => {
          console.log(ex);
          generalResponse.error = true;
          generalResponse.message = ex.message;
          return generalResponse;
        });
      case "noAuth":
        return this.executeNoAuthEndpoint(endpoint, this._requestBody, ServiceURL).then((resp) => {
          generalResponse.error = false;
          generalResponse.message = `Processed Ok!`;
          generalResponse.data = resp;
          return generalResponse;
        }).catch((ex) => {
          console.log(ex);
          generalResponse.error = true;
          generalResponse.message = ex.message;
          return generalResponse;
        });
      case "basicAuth":
        console.log("Calling function BASIC");
        return this.executeBasicAuthEndpoint(endpoint, this._requestBody, ServiceURL, ignoreBody).then((resp) => {
          generalResponse.error = false;
          generalResponse.message = `Processed Ok!`;
          generalResponse.data = resp;
          return generalResponse;
        });
      case "passCredHeaderBody":
        return this.executeCredHeaderBody(endpoint, this._requestBody, ServiceURL).then((resp) => {
          generalResponse.error = false;
          generalResponse.message = `Processed Ok!`;
          generalResponse.data = resp;
          return generalResponse;
        });
      default:
        break;
    }
  }
  executeNoAuthEndpoint(endpoint, body, url) {
    let header = this.computeHeaders(endpoint);
    return this.callWebService({
      serviceURL: url,
      body: body,
      headers: header
    });
  }
  executeBarerAuthEndpoint(endpoint, body, url, token) {
    let authorizationHeader;
    authorizationHeader = `Bearer ${token}`;
    let header = this.computeHeaders(endpoint);
    _.set(header, 'Authorization', authorizationHeader);
    return this.callWebService({
      serviceURL: url,
      body: body,
      headers: header
    });
  }
  executeCredHeaderBody(endpoint, body, url) {
    let authorizationHeader;
    if (!endpoint.auth || !endpoint.auth.username || !endpoint.auth.password) {
      throw new Error("Cred Header Authorization Credentials are required!!");
    }
    let header = this.computeHeaders(endpoint);
    _.set(body, 'username', endpoint.auth.username);
    _.set(body, 'password', endpoint.auth.password);
    _.set(header, 'username', endpoint.auth.username);
    _.set(header, 'password', endpoint.auth.password);
    authorizationHeader = `Basic ${Base64.encode(`${endpoint.auth.username}:${endpoint.auth.password}`)}`;

    _.set(header, 'Authorization', authorizationHeader);
    return this.callWebService({
      serviceURL: url,
      body: body,
      headers: header
    });
  }
  executeBasicAuthEndpoint(endpoint, body, url, ignoreBody) {
    let authorizationHeader;
    if (!endpoint.auth || !endpoint.auth.username || !endpoint.auth.password) {
      throw new Error("Basic Authorization Credentials are required!!");
    }
    authorizationHeader = `Basic ${Base64.encode(`${endpoint.auth.username}:${endpoint.auth.password}`)}`;
    let header = this.computeHeaders(endpoint);
    _.set(header, 'Authorization', authorizationHeader);
    return this.callWebService({
      serviceURL: url,
      body: body,
      headers: header,
      ignoreBody
    });
  }
  computeHeaders(endpoint) {
    let header = {};
    let requestDate = new Date();
    if (endpoint.header) {
      endpoint.header.forEach((elem) => {
        switch (elem.headerType) {
          case "FixedValue":
            _.set(header, elem.headerKey, elem.headerPrefix);
            break;
          case "Datetime":
            let format = elem.headerPrefix || "DD/MM/YYYY hh:mm:ss";
            let datetime = moment(requestDate).format(format)
            _.set(header, elem.headerKey, `${datetime}`);
            break;
          case "DatetimeEpoch":
            _.set(header, elem.headerKey, `${elem.headerPrefix}${requestDate}`);
            break;
          case "UUID":
            _.set(header, elem.headerKey, `${elem.headerPrefix}${this._UUID}`);
            break;
          case "dynamicField":
            let dynifield = _.get(this._requestBody, elem.headerPrefix, "")
            _.set(header, elem.headerKey, `${dynifield}`);
            break;
          case "UUIDN":
            let rand = Math.floor(100000 + Math.random() * 900000);
            _.set(header, elem.headerKey, `${elem.headerPrefix}${rand}`);
            break;
          default:
            break;
        }
      });
    }
    return header;
  }
  callWebService(options) {
    let generalResponse = {
      "error": true,
      "message": "Failed to get response"
    };

    let rpOptions = {
      method: 'POST',
      url: options.serviceURL,
      headers: options.headers,
      timeout: 10000,
      json: !options.ignoreBody
    };
    if (!options.ignoreBody) {
      _.set(rpOptions, 'body', options.body);
    }
    console.log("-------------BEGIN External Request--------------");
    console.log(JSON.stringify(rpOptions, null, 2));
    console.log("-------------END External Request--------------");
    return rp(rpOptions).then((data) => {
      console.log("-------------BEGIN External Response--------------");
      console.log(JSON.stringify(data, null, 2));
      console.log("-------------END External Response--------------");
      let parse = false;
      if (!options.ignoreBody) {
        parse = !options.ignoreBody;
      }
      if (data) {
        if (data.success === false) {
          throw new Error(data.message);
        }
        generalResponse.error = false;
        generalResponse.message = 'Processed Ok!';
        generalResponse.data = data;
        if (options.ignoreBody) {
          return JSON.parse(data);
        }
        return data;
      }
      if (options.ignoreBody) {
        return JSON.parse(data);
      }
      return data;
    }).catch((ex) => {
      console.log("-------------BEGIN Exception On Call --------------");
      console.log(ex);
      console.info("-------------END Exception On Call --------------");
      generalResponse.error = true;
      generalResponse.message = ex.message;
      return generalResponse;
    });
  }

};