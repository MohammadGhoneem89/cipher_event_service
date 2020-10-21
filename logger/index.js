'use strict';

const bunyan = require('../customLog');
const RotatingFileStream = require('bunyan-rotating-file-stream');

const Logger = bunyan.createLogger({
		name: 'PrivacyAdaptor',
		streams: [{
			type: 'raw',
			stream: new RotatingFileStream({
				path: './logs/app-%d-%b-%y.log',
				period: '1d',
				totalFiles: 5,
				rotateExisting: true,
				threshold: '10m',
				totalSize: '20m',
				gzip: true
			})
		}, {
			stream: process.stderr,
        	level: 'error'
		}],
		level: 'trace'
	});

module.exports = Logger;
