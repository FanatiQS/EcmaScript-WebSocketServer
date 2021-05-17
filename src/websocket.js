/**
 * Checks if request is a WebSocket upgrade
 * @param {HttpRequest} req The HTTP request object
 * @returns {boolean} If the request is a WebSocket upgrade or not
 * @throws Is WebSocket upgrade but method is NOT GET
 * @throws Is WebSocket upgrade but HTTP version is not 1.1 or higher
 * @throws Is WebSocket upgrade but WebSocket version is not 13
 * @throws Is WebSocket upgrade but WebSocket key header is not a string
 */
function isWebSocketUpgrade(req) {
	// Retuns false for non websocket upgrades
	if (
		typeof req.headers.connection !== 'string' ||
		req.headers.connection.toLowerCase() !== 'upgrade' ||
		typeof req.headers.upgrade !== 'string' ||
		req.headers.upgrade.toLowerCase() !== 'websocket'
	) return false;
	
	// Spec only allows get requests for upgrade
	if (typeof req.method !== 'string' || req.method.toLowerCase() !== 'get') {
		throw new Error("WebSocket upgrades must be GET requests");
	}

	// Spec only allows http 1.1 or newer
	if (req.httpVersion < 1.1) {
		throw new Error("HTTP version must be at least 1.1");
	}

	// WebSocket version must be 13 according to the spec
	if (req.headers['sec-websocket-version'] != 13) {
		console.log(req.headers['sec-websocket-version'], req.headers)
		throw new Error("Only allows WebSocket version 13");
	}

	// Spec requires websocket key to be defined
	if (typeof req.headers['sec-websocket-key'] !== 'string') {
		throw new Error("Missing WebSocket key");
	}

	return true;
}

/**
 * @callback makeAccept
 * @param {string} key The derived key to hash
 * @returns {string} The key hashed with Sha1 and encoded in base64
 */

/**
 * Makes a WebSocket upgrade response
 * @param {HttpRequest} req The HTTP request known to be an upgrade to WebSocket
 * @param {makeAccept} makeAccept The hasing function that creates the response
 * @returns {string} The HTTP response to upgrade to WebSocket
 * @todo switch from returning string to returning ArrayBuffer
 */
function makeWebSocketUpgradeResponse(req, makeAccept) {
	return "HTTP/1.1 101 Switching Protocols\r\n" +
		"Connection: Upgrade\r\n" +
		"Upgrade: websocket\r\n" +
		"sec-WebSocket-Accept: " +
		makeAccept(
			req.headers['sec-websocket-key'] +
			"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
		) +
		"\r\n\r\n";
}

/**
 * Gets the WebSocket op code from a buffer
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {number} The opCode for the WebSocket frame
 * @throws Is a fragmented frame
 * @throws Has one or more reserved bits set
 * @throws Payload is not masked
 */
function getWebSocketOpCode(buffer) {
	// Does not support fragmented frames
	if (!(buffer[0] & 0x80)) throw new Error('This WebSocket implementation does not support fragmented frames');

	// WebSocket rsv bits should be 0 when not used by extension
	if (buffer[0] & 0x70) throw new Error('Reserved bits are not used and must be 0');

	// Ensures payload is masked
	if (!(buffer[1] & 0x80)) {
		throw new Error("WebSocket payload from clients to server must be masked");
	}

	// Returns op code
	return buffer[0] & 0x0F;
}

/**
 * The possible WebSocket op codes that can be returned from `getWebSocketOpCode` function
 */
const opCodes = {
	text: 0x01,
	binary: 0x02,
	close: 0x08,
	ping: 0x09,
	pong: 0x0A
};

/**
 * Gets the payload from a WebSocket frame
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {ArrayBuffer} Unmasked payload
 * @todo Do some benchmarks on if it is faster to return a buffer or a string
 */
function getWebSocketPayload(buffer) {
	// Gets payload length
	let len = buffer[1] & 0x7F;
	let offset = 2;

	// Handles 16 bit lengths
	if (len === 126) {
		len = buffer[2] << 8 & buffer[3];
		offset = 4;
	}
	// Handles 64 bit lengths
	else if (len === 127) {
		len = buffer[6] << 24 & buffer[7] << 16 & buffer[8] << 8 & buffer[9];
		offset = 10;
	}

	// Unmasks payload from client
	const unmasked = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		unmasked[i] = buffer[i + 4 + offset] ^ buffer[i % 4 + offset];
	}

	return unmasked;
}

// Creates WebSocket length bytes for payload
function getLenBytes(len) {
	if (len < 126) return [ len ];
	if (len < 65536) return [ 126, (len >> 8) & 0xff, len & 0xff ];
	if (len < 4294967296) return [ 127, 0, 0, 0, 0, 
		(len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff ];
	throw new Error("Payload length can not be 32 bit or longer");
}

// Makes a WebSocket frame using specified opCode and containing payload
function makeWebSocketFrame(opCode, payload) {
	const arr = [ 0x80 | opCode, ...getLenBytes(payload.length) ];
	for (let i = 0; i < payload.length; i++) {
		arr.push(payload.charCodeAt(i));
	}
	return new Uint8Array(arr);
}

/**
 * Makes a WebSocket text frame containing the payload
 * @param {string} payload The text content to send in the WebSocket frame
 * @returns {ArrayBuffer} The WebSocket frame containing the payload
 */
function makeWebSocketTextFrame(payload) {
	return makeWebSocketFrame(opCodes.text, payload);
}

/**
 * Makes a WebSocket close frame
 * @returns {ArrayBuffer} The close frame
 * @todo Include payload in close frame when I understand how it works
 */
function makeWebSocketCloseFrame() {
	return new Uint8Array([ 0x88, 0x00 ]);
}

/**
 * Makes a WebSocket ping frame
 * @returns {ArrayBuffer} The ping frame
 * @todo Include payload in ping frame when I understand how it works
 */
function makeWebSocketPingFrame() {
	return new Uint8Array([ 0x89, 0x00 ]);
}



//!! replace later with es6 exports
exports.isWebSocketUpgrade = isWebSocketUpgrade;
exports.makeWebSocketUpgradeResponse = makeWebSocketUpgradeResponse;
exports.getWebSocketOpCode = getWebSocketOpCode;
exports.opCodes = opCodes;
exports.getWebSocketPayload = getWebSocketPayload;
exports.makeWebSocketCloseFrame = makeWebSocketCloseFrame;
exports.makeWebSocketTextFrame = makeWebSocketTextFrame;
exports.makeWebSocketPingFrame = makeWebSocketPingFrame;