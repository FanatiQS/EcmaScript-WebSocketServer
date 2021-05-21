/**
 * @typedef {Array} ArrayBuffer
 * Anything iterable containing integers
 */

/**
 * Converts an array buffer to a string
 * @param {ArrayBuffer} buffer The buffer to convert to a string
 * @returns {string} The buffer converted to a string
 */
function bufferToString(buffer) {
	return String.fromCharCode(...buffer);
}

/**
 * The Request information for an HTTP request
 * All header keys must be lower case
 * @typedef {Object} HttpRequest
 * @property {string} method The method for the HTTP request. Required to be `GET` if upgrading to WebSocket
 * @property {number|string} httpVersion The version of the HTTP protocol used. Required to be `1.1` or higher if upgrading to WebSocket
 * @property {string} headers.connection The header defining the connection type
 * @property {string} headers.upgrade The header defining what protocol to upgrade to if connection is upgrade
 * @property {string} headers.sec-websocket-version The version of the WebSocket protocol to use. Required to be `13` if upgrading to WebSocket
 * @property {string} headers.sec-websocket-key The base64 16 byte random key generated by the client
 */

/**
 * Parses an incomming HTTP request
 * @param {ArrayBuffer} buffer The content of the request as an array buffer
 * @returns {HttpRequest}
 * @todo this assumes that the http request is contained within a single tcp packet
 */
function parseHttp(buffer) {
	// Splits up data on linebreaks
	const splitted = bufferToString(buffer).split('\r\n');

	// Gets data from status line
	const [ method, url, httpVersion ] = splitted.shift().split(' ');

	// Remove last empty line
	splitted.pop();

	// Converts header lines to key and value on object
	const headers = {};
	splitted.forEach((header) => {
		const index = header.indexOf(':');
		headers[header.slice(0, index).trim().toLowerCase()] = header.slice(index + 1).trim();
	});

	return {
		method: method.toUpperCase(),
		url: url.toLowerCase(),
		httpVersion: httpVersion.slice(5),
		headers
	}
}

/**
 * Makes sure HTTP request comes from same origin
 * @param {string} origin The current origin
 * @param {HttpRequest} req The HTTP request to ensure comes from same origin
 * @returns {boolean} If the request is from same origin
 */
function isSameOrigin(origin, req) {
	return headers.origin === origin.toLowerCase();
}

/**
 * Makes a simple HTTP response for HTML content
 * @param {string} body The HTML content to make an HTTP response for
 * @returns {string} The HTTP response containing the body
 * @todo switch from returning string to returning ArrayBuffer?
 */
function makeHttpHtmlResponse(body) {
	return "HTTP/1.1 200 OK\r\n" +
		"Content-Type: text/html\r\n" +
		"Content-Length: " + body.length + "\r\n" +
		"Date: " + new Date() + "\r\n" +
		"\r\n" +
		body;
}

/**
 * Makes a simple HTTP 404 response
 * @returns {string} The HTTP response
 * @todo switch from returning string to returning ArrayBuffer?
 * @todo make it display anything but a blank page
 */
function makeHttp404Response() {
	return "HTTP/1.1 404 Not Found\r\n" +
		"\r\n";
}



//!!
exports.bufferToString = bufferToString;
exports.parseHttp = parseHttp;
exports.makeHttpHtmlResponse = makeHttpHtmlResponse;
exports.makeHttp404Response = makeHttp404Response;
