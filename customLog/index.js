'use strict';

const _ = require('lodash');
const moment = require('moment');
const logFilter = global.config.logFilters || ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

var runtimeEnv;
if (typeof (process) !== 'undefined' && process.versions) {
	if (process.versions.nw) {
		runtimeEnv = 'nw';
	} else if (process.versions.node) {
		runtimeEnv = 'node';
	}
}
if (!runtimeEnv && typeof (window) !== 'undefined' &&
	window.window === window) {
	runtimeEnv = 'browser';
}
if (!runtimeEnv) {
	throw new Error('unknown runtime environment');
}


var os, fs, dtrace;
if (runtimeEnv === 'browser') {
	os = {
		hostname: function () {
			return window.location.host;
		}
	};
	fs = {};
	dtrace = null;
} else {
	os = require('os');
	fs = require('fs');
	try {
		dtrace = require('dtrace-provider' + '');
	} catch (e) {
		dtrace = null;
	}
}
var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var stream = require('stream');

try {
	var safeJsonStringify = require('safe-json-stringify');
} catch (e) {
	safeJsonStringify = null;
}
if (process.env.BUNYAN_TEST_NO_SAFE_JSON_STRINGIFY) {
	safeJsonStringify = null;
}

try {
	var mv = require('mv' + '');
} catch (e) {
	mv = null;
}

try {
	var sourceMapSupport = require('source-map-support' + '');
} catch (_) {
	sourceMapSupport = null;
}

function objCopy(obj) {
	if (obj == null) {  // null or undefined
		return obj;
	} else if (Array.isArray(obj)) {
		return obj.slice();
	} else if (typeof (obj) === 'object') {
		var copy = {};
		Object.keys(obj).forEach(function (k) {
			copy[k] = obj[k];
		});
		return copy;
	} else {
		return obj;
	}
}

var format = util.format;
if (!format) {
	
	var inspect = util.inspect;
	var formatRegExp = /%[sdj%]/g;
	format = function format(f) {
		if (typeof (f) !== 'string') {
			var objects = [];
			for (var i = 0; i < arguments.length; i++) {
				objects.push(inspect(arguments[i]));
			}
			return objects.join(' ');
		}
		
		var i = 1;
		var args = arguments;
		var len = args.length;
		var str = String(f).replace(formatRegExp, function (x) {
			if (i >= len)
				return x;
			switch (x) {
				case '%s': return String(args[i++]);
				case '%d': return Number(args[i++]);
				case '%j': return fastAndSafeJsonStringify(args[i++]);
				case '%%': return '%';
				default:
					return x;
			}
		});
		for (var x = args[i]; i < len; x = args[++i]) {
			if (x === null || typeof (x) !== 'object') {
				str += ' ' + x;
			} else {
				str += ' ' + inspect(x);
			}
		}
		return str;
	};
}

function getCaller3Info() {
	if (this === undefined) {
		// Cannot access caller info in 'strict' mode.
		return;
	}
	var obj = {};
	var saveLimit = Error.stackTraceLimit;
	var savePrepare = Error.prepareStackTrace;
	Error.stackTraceLimit = 3;
	
	Error.prepareStackTrace = function (_, stack) {
		var caller = stack[2];
		if (sourceMapSupport) {
			caller = sourceMapSupport.wrapCallSite(caller);
		}
		obj.file = caller.getFileName();
		obj.line = caller.getLineNumber();
		var func = caller.getFunctionName();
		if (func)
			obj.func = func;
	};
	Error.captureStackTrace(this, getCaller3Info);
	this.stack;
	
	Error.stackTraceLimit = saveLimit;
	Error.prepareStackTrace = savePrepare;
	return obj;
}


function _indent(s, indent) {
	if (!indent) indent = '    ';
	var lines = s.split(/\r?\n/g);
	return indent + lines.join('\n' + indent);
}

function _warn(msg, dedupKey) {
	assert.ok(msg);
	if (dedupKey) {
		if (_warned[dedupKey]) {
			return;
		}
		_warned[dedupKey] = true;
	}
	process.stderr.write(msg + '\n');
}
function _haveWarned(dedupKey) {
	return _warned[dedupKey];
}
var _warned = {};


function ConsoleRawStream() {}
ConsoleRawStream.prototype.write = function (rec) {
	if (rec.level < INFO) {
		console.log(rec);
	} else if (rec.level < WARN) {
		console.info(rec);
	} else if (rec.level < ERROR) {
		console.warn(rec);
	} else {
		console.error(rec);
	}
};


//---- Levels

var TRACE = 10;
var DEBUG = 20;
var INFO = 30;
var WARN = 40;
var ERROR = 50;
var FATAL = 60;

var levelFromName = {
	'trace': TRACE,
	'debug': DEBUG,
	'info': INFO,
	'warn': WARN,
	'error': ERROR,
	'fatal': FATAL
};
var nameFromLevel = {};
Object.keys(levelFromName).forEach(function (name) {
	nameFromLevel[levelFromName[name]] = name;
});

// Dtrace probes.
var dtp = undefined;
var probes = dtrace && {};

function resolveLevel(nameOrNum) {
	var level;
	var type = typeof (nameOrNum);
	if (type === 'string') {
		level = levelFromName[nameOrNum.toLowerCase()];
		if (!level) {
			throw new Error(format('unknown level name: "%s"', nameOrNum));
		}
	} else if (type !== 'number') {
		throw new TypeError(format('cannot resolve level: invalid arg (%s):',
			type, nameOrNum));
	} else if (nameOrNum < 0 || Math.floor(nameOrNum) !== nameOrNum) {
		throw new TypeError(format('level is not a positive integer: %s',
			nameOrNum));
	} else {
		level = nameOrNum;
	}
	return level;
}


function isWritable(obj) {
	if (obj instanceof stream.Writable) {
		return true;
	}
	return typeof (obj.write) === 'function';
}

function Logger(options, _childOptions, _childSimple) {
	if (!(this instanceof Logger)) {
		return new Logger(options, _childOptions);
	}
	
	// Input arg validation.
	var parent;
	if (_childOptions !== undefined) {
		parent = options;
		options = _childOptions;
		if (!(parent instanceof Logger)) {
			throw new TypeError(
				'invalid Logger creation: do not pass a second arg');
		}
	}
	if (!options) {
		throw new TypeError('options (object) is required');
	}
	if (!parent) {
		if (!options.name) {
			throw new TypeError('options.name (string) is required');
		}
	} else {
		if (options.name) {
			throw new TypeError(
				'invalid options.name: child cannot set logger name');
		}
	}
	if (options.stream && options.streams) {
		throw new TypeError('cannot mix "streams" and "stream" options');
	}
	if (options.streams && !Array.isArray(options.streams)) {
		throw new TypeError('invalid options.streams: must be an array')
	}
	if (options.serializers && (typeof (options.serializers) !== 'object' ||
			Array.isArray(options.serializers))) {
		throw new TypeError('invalid options.serializers: must be an object')
	}
	
	EventEmitter.call(this);
	
	// Fast path for simple child creation.
	if (parent && _childSimple) {
		// `_isSimpleChild` is a signal to stream close handling that this child
		// owns none of its streams.
		this._isSimpleChild = true;
		
		this._level = parent._level;
		this.streams = parent.streams;
		this.serializers = parent.serializers;
		this.src = parent.src;
		var fields = this.fields = {};
		var parentFieldNames = Object.keys(parent.fields);
		for (var i = 0; i < parentFieldNames.length; i++) {
			var name = parentFieldNames[i];
			fields[name] = parent.fields[name];
		}
		var names = Object.keys(options);
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			fields[name] = options[name];
		}
		return;
	}
	
	// Start values.
	var self = this;
	if (parent) {
		this._level = parent._level;
		this.streams = [];
		for (var i = 0; i < parent.streams.length; i++) {
			var s = objCopy(parent.streams[i]);
			s.closeOnExit = false; // Don't own parent stream.
			this.streams.push(s);
		}
		this.serializers = objCopy(parent.serializers);
		this.src = parent.src;
		this.fields = objCopy(parent.fields);
		if (options.level) {
			this.level(options.level);
		}
	} else {
		this._level = Number.POSITIVE_INFINITY;
		this.streams = [];
		this.serializers = null;
		this.src = false;
		this.fields = {};
	}
	
	if (!dtp && dtrace) {
		dtp = dtrace.createDTraceProvider('bunyan');
		
		for (var level in levelFromName) {
			var probe;
			
			probes[levelFromName[level]] = probe =
				dtp.addProbe('log-' + level, 'char *');
			probe.dtp = dtp;
		}
		
		dtp.enable();
	}
	
	if (options.stream) {
		self.addStream({
			type: 'stream',
			stream: options.stream,
			closeOnExit: false,
			level: options.level
		});
	} else if (options.streams) {
		options.streams.forEach(function (s) {
			self.addStream(s, options.level);
		});
	} else if (parent && options.level) {
		this.level(options.level);
	} else if (!parent) {
		if (runtimeEnv === 'browser') {
			self.addStream({
				type: 'raw',
				stream: new ConsoleRawStream(),
				closeOnExit: false,
				level: options.level
			});
		} else {
			self.addStream({
				type: 'stream',
				stream: process.stdout,
				closeOnExit: false,
				level: options.level
			});
		}
	}
	if (options.serializers) {
		self.addSerializers(options.serializers);
	}
	if (options.src) {
		this.src = true;
	}
	
	var fields = objCopy(options);
	delete fields.stream;
	delete fields.level;
	delete fields.streams;
	delete fields.serializers;
	delete fields.src;
	if (this.serializers) {
		this._applySerializers(fields);
	}
	if (!fields.hostname && !self.fields.hostname) {
		fields.hostname = os.hostname();
	}
	if (!fields.pid) {
		fields.pid = process.pid;
	}
	Object.keys(fields).forEach(function (k) {
		self.fields[k] = fields[k];
	});
}

util.inherits(Logger, EventEmitter);

Logger.prototype.addStream = function addStream(s, defaultLevel) {
	var self = this;
	if (defaultLevel === null || defaultLevel === undefined) {
		defaultLevel = INFO;
	}
	
	s = objCopy(s);
	
	// Implicit 'type' from other args.
	if (!s.type) {
		if (s.stream) {
			s.type = 'stream';
		} else if (s.path) {
			s.type = 'file'
		}
	}
	s.raw = (s.type === 'raw');  // PERF: Allow for faster check in `_emit`.
	
	if (s.level !== undefined) {
		s.level = resolveLevel(s.level);
	} else {
		s.level = resolveLevel(defaultLevel);
	}
	if (s.level < self._level) {
		self._level = s.level;
	}
	
	switch (s.type) {
		case 'stream':
			assert.ok(isWritable(s.stream),
				'"stream" stream is not writable: ' + util.inspect(s.stream));
			
			if (!s.closeOnExit) {
				s.closeOnExit = false;
			}
			break;
		case 'file':
			if (s.reemitErrorEvents === undefined) {
				s.reemitErrorEvents = true;
			}
			if (!s.stream) {
				s.stream = fs.createWriteStream(s.path,
					{flags: 'a', encoding: 'utf8'});
				if (!s.closeOnExit) {
					s.closeOnExit = true;
				}
			} else {
				if (!s.closeOnExit) {
					s.closeOnExit = false;
				}
			}
			break;
		case 'rotating-file':
			assert.ok(!s.stream,
				'"rotating-file" stream should not give a "stream"');
			assert.ok(s.path);
			assert.ok(mv, '"rotating-file" stream type is not supported: '
				+ 'missing "mv" module');
			s.stream = new RotatingFileStream(s);
			if (!s.closeOnExit) {
				s.closeOnExit = true;
			}
			break;
		case 'raw':
			if (!s.closeOnExit) {
				s.closeOnExit = false;
			}
			break;
		default:
			throw new TypeError('unknown stream type "' + s.type + '"');
	}
	
	if (s.reemitErrorEvents && typeof (s.stream.on) === 'function') {
		// TODO: When we have `<logger>.close()`, it should remove event
		//      listeners to not leak Logger instances.
		s.stream.on('error', function onStreamError(err) {
			self.emit('error', err, s);
		});
	}
	
	self.streams.push(s);
	delete self.haveNonRawStreams;  // reset
}

Logger.prototype.addSerializers = function addSerializers(serializers) {
	var self = this;
	
	if (!self.serializers) {
		self.serializers = {};
	}
	Object.keys(serializers).forEach(function (field) {
		var serializer = serializers[field];
		if (typeof (serializer) !== 'function') {
			throw new TypeError(format(
				'invalid serializer for "%s" field: must be a function',
				field));
		} else {
			self.serializers[field] = serializer;
		}
	});
}

Logger.prototype.child = function (options, simple) {
	return new (this.constructor)(this, options || {}, simple);
}

Logger.prototype.reopenFileStreams = function () {
	var self = this;
	self.streams.forEach(function (s) {
		if (s.type === 'file') {
			if (s.stream) {
				// Not sure if typically would want this, or more immediate
				// `s.stream.destroy()`.
				s.stream.end();
				s.stream.destroySoon();
				delete s.stream;
			}
			s.stream = fs.createWriteStream(s.path,
				{flags: 'a', encoding: 'utf8'});
			s.stream.on('error', function (err) {
				self.emit('error', err, s);
			});
		}
	});
};

Logger.prototype.level = function level(value) {
	if (value === undefined) {
		return this._level;
	}
	var newLevel = resolveLevel(value);
	var len = this.streams.length;
	for (var i = 0; i < len; i++) {
		this.streams[i].level = newLevel;
	}
	this._level = newLevel;
}

Logger.prototype.levels = function levels(name, value) {
	if (name === undefined) {
		assert.equal(value, undefined);
		return this.streams.map(
			function (s) { return s.level });
	}
	var stream;
	if (typeof (name) === 'number') {
		stream = this.streams[name];
		if (stream === undefined) {
			throw new Error('invalid stream index: ' + name);
		}
	} else {
		var len = this.streams.length;
		for (var i = 0; i < len; i++) {
			var s = this.streams[i];
			if (s.name === name) {
				stream = s;
				break;
			}
		}
		if (!stream) {
			throw new Error(format('no stream with name "%s"', name));
		}
	}
	if (value === undefined) {
		return stream.level;
	} else {
		var newLevel = resolveLevel(value);
		stream.level = newLevel;
		if (newLevel < this._level) {
			this._level = newLevel;
		}
	}
}

Logger.prototype._applySerializers = function (fields, excludeFields) {
	var self = this;
	
	Object.keys(this.serializers).forEach(function (name) {
		if (fields[name] === undefined ||
			(excludeFields && excludeFields[name]))
		{
			return;
		}
		try {
			fields[name] = self.serializers[name](fields[name]);
		} catch (err) {
			_warn(format('bunyan: ERROR: Exception thrown from the "%s" '
				+ 'Bunyan serializer. This should never happen. This is a bug '
				+ 'in that serializer function.\n%s',
				name, err.stack || err));
			fields[name] = format('(Error in Bunyan log "%s" serializer '
				+ 'broke field. See stderr for details.)', name);
		}
	});
}

Logger.prototype._emit = function (rec, noemit) {
	var i;
	
	// Lazily determine if this Logger has non-'raw' streams. If there are
	// any, then we need to stringify the log record.
	if (this.haveNonRawStreams === undefined) {
		this.haveNonRawStreams = false;
		for (i = 0; i < this.streams.length; i++) {
			if (!this.streams[i].raw) {
				this.haveNonRawStreams = true;
				break;
			}
		}
	}
	
	// Stringify the object (creates a warning str on error).
	var str;
	if (noemit || this.haveNonRawStreams) {
		str = fastAndSafeJsonStringify(rec) + '\n';
	}
	
	if (noemit)
		return str;
	
	var level = rec.level;
	for (i = 0; i < this.streams.length; i++) {
		var s = this.streams[i];
		var recLevel = nameFromLevel[rec.level] || '-';
		if (s.level <= level && logFilter.indexOf(recLevel) >= 0) {
			var recFs = rec.fs || '-';
			var recFunc = rec.func || '-';
			if(recFs.length < 30){
				recFs = recFs + new Array(31 - recFs.length).join(' ');
			}
			recFs = _.truncate(recFs);
			if(recFunc.length < 30){
				recFunc = recFunc + new Array(31 - recFunc.length).join(' ');
			}
			recFunc = _.truncate(recFunc);
			
			if(recLevel.length < 7){
				recLevel = recLevel + new Array(8 - recLevel.length).join(' ');
			}
			recLevel = _.truncate(recLevel, {length: 7, omission: ' '});
			var errorDesc = '';
			if(rec.level === 40 || rec.level === 50 || rec.level === 60){
				errorDesc = str;
			}
			var recTime = moment(rec.time).format('DD.MM.YYYY H:m:s.SS');
			var st  = recTime + ' | ' + recLevel + ' | ' + rec.name + ' | ' + recFs + ' | ' + recFunc + ' | ' + rec.msg + '\n' + errorDesc;
			s.stream.write(st);
		}
	};
	
	return str;
}

function mkRecord(log, minLevel, args) {
	var excludeFields, fields, msgArgs;
	if (args[0] instanceof Error) {
		// `log.<level>(err, ...)`
		fields = {
			// Use this Logger's err serializer, if defined.
			err: (log.serializers && log.serializers.err
				? log.serializers.err(args[0])
				: Logger.stdSerializers.err(args[0]))
		};
		excludeFields = {err: true};
		if (args.length === 1) {
			msgArgs = [fields.err.message];
		} else {
			msgArgs = args.slice(1);
		}
	} else if (typeof (args[0]) !== 'object' || Array.isArray(args[0])) {
		// `log.<level>(msg, ...)`
		fields = null;
		msgArgs = args.slice();
	} else if (Buffer.isBuffer(args[0])) {  // `log.<level>(buf, ...)`
		// Almost certainly an error, show `inspect(buf)`. See bunyan
		// issue #35.
		fields = null;
		msgArgs = args.slice();
		msgArgs[0] = util.inspect(msgArgs[0]);
	} else {  // `log.<level>(fields, msg, ...)`
		fields = args[0];
		if (fields && args.length === 1 && fields.err &&
			fields.err instanceof Error)
		{
			msgArgs = [fields.err.message];
		} else {
			msgArgs = args.slice(1);
		}
	}
	
	// Build up the record object.
	var rec = objCopy(log.fields);
	var level = rec.level = minLevel;
	var recFields = (fields ? objCopy(fields) : null);
	if (recFields) {
		if (log.serializers) {
			log._applySerializers(recFields, excludeFields);
		}
		Object.keys(recFields).forEach(function (k) {
			rec[k] = recFields[k];
		});
	}
	rec.msg = format.apply(log, msgArgs);
	if (!rec.time) {
		rec.time = (new Date());
	}
	// Get call source info
	if (log.src && !rec.src) {
		rec.src = getCaller3Info()
	}
	rec.v = 0;
	
	return rec;
};

function mkProbeArgs(str, log, minLevel, msgArgs) {
	return [ str || log._emit(mkRecord(log, minLevel, msgArgs), true) ];
}

function mkLogEmitter(minLevel) {
	return function () {
		var log = this;
		var str = null;
		var rec = null;
		
		if (!this._emit) {
			var dedupKey = 'unbound';
			if (!_haveWarned[dedupKey]) {
				var caller = getCaller3Info();
				_warn(format('bunyan usage error: %s:%s: attempt to log '
					+ 'with an unbound log method: `this` is: %s',
					caller.file, caller.line, util.inspect(this)),
					dedupKey);
			}
			return;
		} else if (arguments.length === 0) {   // `log.<level>()`
			return (this._level <= minLevel);
		}
		
		var msgArgs = new Array(arguments.length);
		for (var i = 0; i < msgArgs.length; ++i) {
			msgArgs[i] = arguments[i];
		}
		
		if (this._level <= minLevel) {
			rec = mkRecord(log, minLevel, msgArgs);
			str = this._emit(rec);
		}
		
		if (probes) {
			probes[minLevel].fire(mkProbeArgs, str, log, minLevel, msgArgs);
		}
	}
}

Logger.prototype.trace = mkLogEmitter(TRACE);
Logger.prototype.debug = mkLogEmitter(DEBUG);
Logger.prototype.info = mkLogEmitter(INFO);
Logger.prototype.warn = mkLogEmitter(WARN);
Logger.prototype.error = mkLogEmitter(ERROR);
Logger.prototype.fatal = mkLogEmitter(FATAL);

Logger.stdSerializers = {};

Logger.stdSerializers.req = function (req) {
	if (!req || !req.connection)
		return req;
	return {
		method: req.method,
		url: req.url,
		headers: req.headers,
		remoteAddress: req.connection.remoteAddress,
		remotePort: req.connection.remotePort
	};
	
};

Logger.stdSerializers.res = function (res) {
	if (!res || !res.statusCode)
		return res;
	return {
		statusCode: res.statusCode,
		header: res._header
	}
};

function getFullErrorStack(ex)
{
	var ret = ex.stack || ex.toString();
	if (ex.cause && typeof (ex.cause) === 'function') {
		var cex = ex.cause();
		if (cex) {
			ret += '\nCaused by: ' + getFullErrorStack(cex);
		}
	}
	return (ret);
}

var errSerializer = Logger.stdSerializers.err = function (err) {
	if (!err || !err.stack)
		return err;
	var obj = {
		message: err.message,
		name: err.name,
		stack: getFullErrorStack(err),
		code: err.code,
		signal: err.signal
	}
	return obj;
};

function safeCyclesSet() {
	var seen = new Set();
	return function (key, val) {
		if (!val || typeof (val) !== 'object') {
			return val;
		}
		if (seen.has(val)) {
			return '[Circular]';
		}
		seen.add(val);
		return val;
	};
}

function safeCyclesArray() {
	var seen = [];
	return function (key, val) {
		if (!val || typeof (val) !== 'object') {
			return val;
		}
		if (seen.indexOf(val) !== -1) {
			return '[Circular]';
		}
		seen.push(val);
		return val;
	};
}

var safeCycles = typeof (Set) !== 'undefined' ? safeCyclesSet : safeCyclesArray;

function fastAndSafeJsonStringify(rec) {
	try {
		return JSON.stringify(rec);
	} catch (ex) {
		try {
			return JSON.stringify(rec, safeCycles());
		} catch (e) {
			if (safeJsonStringify) {
				return safeJsonStringify(rec);
			} else {
				var dedupKey = e.stack.split(/\n/g, 3).join('\n');
				_warn('bunyan: ERROR: Exception in '
					+ '`JSON.stringify(rec)`. You can install the '
					+ '"safe-json-stringify" module to have Bunyan fallback '
					+ 'to safer stringification. Record:\n'
					+ _indent(format('%s\n%s', util.inspect(rec), e.stack)),
					dedupKey);
				return format('(Exception in JSON.stringify(rec): %j. '
					+ 'See stderr for details.)', e.message);
			}
		}
	}
}


var RotatingFileStream = null;
if (mv) {
	
	RotatingFileStream = function RotatingFileStream(options) {
		this.path = options.path;
		
		this.count = (options.count == null ? 10 : options.count);
		assert.equal(typeof (this.count), 'number',
			format('rotating-file stream "count" is not a number: %j (%s) in %j',
				this.count, typeof (this.count), this));
		assert.ok(this.count >= 0,
			format('rotating-file stream "count" is not >= 0: %j in %j',
				this.count, this));
		
		if (options.period) {
			
			var period = {
				'hourly': '1h',
				'daily': '1d',
				'weekly': '1w',
				'monthly': '1m',
				'yearly': '1y'
			}[options.period] || options.period;
			var m = /^([1-9][0-9]*)([hdwmy]|ms)$/.exec(period);
			if (!m) {
				throw new Error(format('invalid period: "%s"', options.period));
			}
			this.periodNum = Number(m[1]);
			this.periodScope = m[2];
		} else {
			this.periodNum = 1;
			this.periodScope = 'd';
		}
		
		var lastModified = null;
		try {
			var fileInfo = fs.statSync(this.path);
			lastModified = fileInfo.mtime.getTime();
		}
		catch (err) {
			// file doesn't exist
		}
		var rotateAfterOpen = false;
		if (lastModified) {
			var lastRotTime = this._calcRotTime(0);
			if (lastModified < lastRotTime) {
				rotateAfterOpen = true;
			}
		}
		
		this.stream = fs.createWriteStream(this.path,
			{flags: 'a', encoding: 'utf8'});
		
		this.rotQueue = [];
		this.rotating = false;
		if (rotateAfterOpen) {
			this._debug('rotateAfterOpen -> call rotate()');
			this.rotate();
		} else {
			this._setupNextRot();
		}
	}
	
	util.inherits(RotatingFileStream, EventEmitter);
	
	RotatingFileStream.prototype._debug = function () {
		// Set this to `true` to add debug logging.
		if (false) {
			if (arguments.length === 0) {
				return true;
			}
			var args = Array.prototype.slice.call(arguments);
			args[0] = '[' + (new Date().toISOString()) + ', '
				+ this.path + '] ' + args[0];
			console.log.apply(this, args);
		} else {
			return false;
		}
	};
	
	RotatingFileStream.prototype._setupNextRot = function () {
		this.rotAt = this._calcRotTime(1);
		this._setRotationTimer();
	}
	
	RotatingFileStream.prototype._setRotationTimer = function () {
		var self = this;
		var delay = this.rotAt - Date.now();
		var TIMEOUT_MAX = 2147483647; // 2^31-1
		if (delay > TIMEOUT_MAX) {
			delay = TIMEOUT_MAX;
		}
		this.timeout = setTimeout(
			function () {
				self._debug('_setRotationTimer timeout -> call rotate()');
				self.rotate();
			},
			delay);
		if (typeof (this.timeout.unref) === 'function') {
			this.timeout.unref();
		}
	}
	
	RotatingFileStream.prototype._calcRotTime =
		function _calcRotTime(periodOffset) {
			this._debug('_calcRotTime: %s%s', this.periodNum, this.periodScope);
			var d = new Date();
			
			this._debug('  now local: %s', d);
			this._debug('    now utc: %s', d.toISOString());
			var rotAt;
			switch (this.periodScope) {
				case 'ms':
					// Hidden millisecond period for debugging.
					if (this.rotAt) {
						rotAt = this.rotAt + this.periodNum * periodOffset;
					} else {
						rotAt = Date.now() + this.periodNum * periodOffset;
					}
					break;
				case 'h':
					if (this.rotAt) {
						rotAt = this.rotAt + this.periodNum * 60 * 60 * 1000 * periodOffset;
					} else {
						rotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
							d.getUTCDate(), d.getUTCHours() + periodOffset);
					}
					break;
				case 'd':
					if (this.rotAt) {
						rotAt = this.rotAt + this.periodNum * 24 * 60 * 60 * 1000
							* periodOffset;
					} else {
						rotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
							d.getUTCDate() + periodOffset);
					}
					break;
				case 'w':
					if (this.rotAt) {
						rotAt = this.rotAt + this.periodNum * 7 * 24 * 60 * 60 * 1000
							* periodOffset;
					} else {
						var dayOffset = (7 - d.getUTCDay());
						if (periodOffset < 1) {
							dayOffset = -d.getUTCDay();
						}
						if (periodOffset > 1 || periodOffset < -1) {
							dayOffset += 7 * periodOffset;
						}
						rotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
							d.getUTCDate() + dayOffset);
					}
					break;
				case 'm':
					if (this.rotAt) {
						rotAt = Date.UTC(d.getUTCFullYear(),
							d.getUTCMonth() + this.periodNum * periodOffset, 1);
					} else {
						// First time: the start of the next month.
						rotAt = Date.UTC(d.getUTCFullYear(),
							d.getUTCMonth() + periodOffset, 1);
					}
					break;
				case 'y':
					if (this.rotAt) {
						rotAt = Date.UTC(d.getUTCFullYear() + this.periodNum * periodOffset,
							0, 1);
					} else {
						rotAt = Date.UTC(d.getUTCFullYear() + periodOffset, 0, 1);
					}
					break;
				default:
					assert.fail(format('invalid period scope: "%s"', this.periodScope));
			}
			
			if (this._debug()) {
				this._debug('  **rotAt**: %s (utc: %s)', rotAt,
					new Date(rotAt).toUTCString());
				var now = Date.now();
				this._debug('        now: %s (%sms == %smin == %sh to go)',
					now,
					rotAt - now,
					(rotAt-now)/1000/60,
					(rotAt-now)/1000/60/60);
			}
			return rotAt;
		};
	
	RotatingFileStream.prototype.rotate = function rotate() {
		var self = this;
		
		if (self.rotAt && self.rotAt > Date.now()) {
			return self._setRotationTimer();
		}
		
		this._debug('rotate');
		if (self.rotating) {
			throw new TypeError('cannot start a rotation when already rotating');
		}
		self.rotating = true;
		
		self.stream.end();  // XXX can do moves sync after this? test at high rate
		
		function del() {
			var toDel = self.path + '.' + String(n - 1);
			if (n === 0) {
				toDel = self.path;
			}
			n -= 1;
			self._debug('  rm %s', toDel);
			fs.unlink(toDel, function (delErr) {
				//XXX handle err other than not exists
				moves();
			});
		}
		
		function moves() {
			if (self.count === 0 || n < 0) {
				return finish();
			}
			var before = self.path;
			var after = self.path + '.' + String(n);
			if (n > 0) {
				before += '.' + String(n - 1);
			}
			n -= 1;
			fs.exists(before, function (exists) {
				if (!exists) {
					moves();
				} else {
					self._debug('  mv %s %s', before, after);
					mv(before, after, function (mvErr) {
						if (mvErr) {
							self.emit('error', mvErr);
							finish(); // XXX finish here?
						} else {
							moves();
						}
					});
				}
			})
		}
		
		function finish() {
			self._debug('  open %s', self.path);
			self.stream = fs.createWriteStream(self.path,
				{flags: 'a', encoding: 'utf8'});
			var q = self.rotQueue, len = q.length;
			for (var i = 0; i < len; i++) {
				self.stream.write(q[i]);
			}
			self.rotQueue = [];
			self.rotating = false;
			self.emit('drain');
			self._setupNextRot();
		}
		
		var n = this.count;
		del();
	};
	
	RotatingFileStream.prototype.write = function write(s) {
		if (this.rotating) {
			this.rotQueue.push(s);
			return false;
		} else {
			return this.stream.write(s);
		}
	};
	
	RotatingFileStream.prototype.end = function end(s) {
		this.stream.end();
	};
	
	RotatingFileStream.prototype.destroy = function destroy(s) {
		this.stream.destroy();
	};
	
	RotatingFileStream.prototype.destroySoon = function destroySoon(s) {
		this.stream.destroySoon();
	};
	
}

function RingBuffer(options) {
	this.limit = options && options.limit ? options.limit : 100;
	this.writable = true;
	this.records = [];
	EventEmitter.call(this);
}

util.inherits(RingBuffer, EventEmitter);

RingBuffer.prototype.write = function (record) {
	if (!this.writable)
		throw (new Error('RingBuffer has been ended already'));
	
	this.records.push(record);
	
	if (this.records.length > this.limit)
		this.records.shift();
	
	return (true);
};

RingBuffer.prototype.end = function () {
	if (arguments.length > 0)
		this.write.apply(this, Array.prototype.slice.call(arguments));
	this.writable = false;
};

RingBuffer.prototype.destroy = function () {
	this.writable = false;
	this.emit('close');
};

RingBuffer.prototype.destroySoon = function () {
	this.destroy();
};


module.exports = Logger;

module.exports.TRACE = TRACE;
module.exports.DEBUG = DEBUG;
module.exports.INFO = INFO;
module.exports.WARN = WARN;
module.exports.ERROR = ERROR;
module.exports.FATAL = FATAL;
module.exports.resolveLevel = resolveLevel;
module.exports.levelFromName = levelFromName;
module.exports.nameFromLevel = nameFromLevel;

module.exports.createLogger = function createLogger(options) {
	return new Logger(options);
};

module.exports.RingBuffer = RingBuffer;
module.exports.RotatingFileStream = RotatingFileStream;

module.exports.safeCycles = safeCycles;
