function Request() {
	this.headers = {};
	this.method = null;
	this.uri = null;
	this.body = null;
	this.buffer = '';
	this.state = 0;
	this.delimiter = ' ';
	this.delimiterLength = 1;
}

// Extracts the method for an HTTP request
Request.prototype[0] = function (chunk, start, end) {
	this.method = chunk.slice(start, end);
	this.state++;
};

// Extracts the URI for an HTTP request
Request.prototype[1] = function (chunk, start, end) {
	this.uri = chunk.slice(start, end);
	this.state++;
	this.delimiter = '\r\n';
};

// Validates the protocol for an HTTP request
Request.prototype[2] = function (chunk, start, end) {
	if (chunk.slice(start, end) !== 'HTTP/1.1') {
		throw new Error('Invalid HTTP version');
	}
	this.state++;
	this.delimiterLength = 2;
};

// Extracts the headers for an HTTP request
Request.prototype[3] = function (chunk, start, end) {
	const index = chunk.indexOf(':', start);
	this.headers[chunk.slice(start, index)] = chunk.slice(index + 1, end);
};

// Extracts the body for an HTTP request
Request.prototype[4] = function (chunk, index) {
	const len = this.headers['Content-Length'];
	if (!len || len == (this.body = chunk.slice(index)).length) return true;
};

// Parses a chunk of an HTTP request
Request.prototype.parse = function (chunk) {
	// Adds the buffer before the string chunk
	chunk = this.buffer + chunk;

	//!!
	let index = 0;
	while (this.state < 4) {
		const end = chunk.indexOf(this.delimiter, index);
		if (end === -1) break;
		if (end === index) {
			this.state = 4
			break;
		}
		this[this.state](chunk, index, end);
		index = end + this.delimiterLength;
	}

	// Parsing is completed when body handler returns true
	if (this.state === 4 && this[4](chunk, index + 2)) return true;

	// Buffers unhandled part of string chunk
	this.buffer = chunk.slice(index);
};

// Gets clean value of specified header
Request.prototype.getHeader = function (header) {
	return this.headers[header].trim();
};

module.exports = Request;
