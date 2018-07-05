'use strict';

const request = require('request');
const config = require('./config/config.json');

function get(callback) {
	const options = {
		method: 'POST',
		url: config.keyVault.url,
		body: { env: config.keyVault.env, header: config.keyVault.header },
		json: true
	};
	request(options, callback);
}

module.exports = {
	get: get
};
