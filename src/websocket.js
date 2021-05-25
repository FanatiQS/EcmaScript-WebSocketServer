'use strict';

import { makeHttpResponse } from "./http.js";
import makeAccept from './sha1b64.js';

/**
 * Checks if request is a WebSocket upgrade
 * @param {HttpRequest} req The HTTP request object
 * @returns {boolean} If the request is a WebSocket upgrade or not
 * Error objects has `response` property with HTTP response for error
 * @throws Is WebSocket upgrade but method is NOT GET
 * @throws Is WebSocket upgrade but HTTP version is not 1.1 or higher
 * @throws Is WebSocket upgrade but WebSocket version is not 13
 * @throws Is WebSocket upgrade but WebSocket key header is not a string
 */
export function isWebSocketUpgrade(req) {
	// Retuns false for non websocket upgrades
	if (
		typeof req.headers.connection !== 'string' ||
		req.headers.connection.toLowerCase() !== 'upgrade'
	) return false;

	// Only accepts upgrade to WebSocket
	if (
		typeof req.headers.upgrade !== 'string' ||
		req.headers.upgrade.toLowerCase() !== 'websocket'
	) {
		const err = new Error("This WebSocket implementation can not handle HTTP upgrades to anything other than the WebSocket protocol");
		err.code = "INVALID_WS_UPGR";
		throw err;
	}

	// Spec only allows GET requests for upgrade
	if (typeof req.method !== 'string' || req.method.toLowerCase() !== 'get') {
		const err = new Error("WebSocket upgrades must be GET requests");
		err.code = "INVALID_METHOD";
		throw err;
	}

	// Spec only allows http 1.1 or newer
	if (req.httpVersion < 1.1) {
		const err = new Error("HTTP version must be at least 1.1");
		err.code = "INVALID_HTTP_VERSION"
		throw err;
	}

	// Spec has only defined WebSocket version 13
	if (req.headers['sec-websocket-version'] != 13) {
		const err = new Error("Only allows WebSocket version 13");
		err.code = "INVALID_WS_VERSION";
		throw err;
	}

	// Spec requires websocket key to be defined
	if (typeof req.headers['sec-websocket-key'] !== 'string') {
		const err = new Error("Missing WebSocket key");
		err.code = "INVALID_WS_KEY";
		throw err;
	}

	return true;
}

/**
 * @param {Error} err An error from isWebSocketUpgrade function
 * @returns {string} An HTTP response form that error
 * @throws Error is not from isWebSocketUpgrade function
 */
export function makeFailedHttpUpgradeResponse(err) {
	switch (err.code) {
		case "INVALID_WS_UPGR": return makeHttpHeaderResponse(426, { Upgrade: "websocket" });
		case "INVALID_METHOD": return makeHttpResponse(400);
		case "INVALID_HTTP_VERSION": return makeHttpResponse(400);
		case "INVALID_WS_VERSION": return makeHttpHeaderResponse(426, { ["Sec-WebSocket-Version"]: 13 });
		case "INVALID_WS_KEY": return makeHttpResponse(400);
	}
	throw new Error("No Error or invalid error code");
}

/**
 * Makes a WebSocket upgrade response
 * @param {HttpRequest} req The HTTP request known to be an upgrade to WebSocket
 * @returns {string} The HTTP response to upgrade to WebSocket
 */
export function makeWebSocketUpgradeResponse(req) {
	return "HTTP/1.1 101 Switching Protocols\r\n" +
		"Connection: Upgrade\r\n" +
		"Upgrade: websocket\r\n" +
		"Sec-WebSocket-Accept: " +
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
 * @throws Control frame has message longer than 125
 */
export function getWebSocketOpCode(buffer) {
	// Does not support fragmented frames
	if (!(buffer[0] & 0x80)) {
		const err = new Error('This WebSocket implementation does not support fragmented frames');
		err.closeCode = 1003;
		throw err;
	}

	// WebSocket rsv bits should be 0 when not used by extension
	if (buffer[0] & 0x70) {
		const err = new Error('Reserved bits are not used and must be 0');
		err.closeCode = 1002;
		throw err;
	}

	// Ensures payload is masked
	if (!(buffer[1] & 0x80)) {
		const err = new Error("WebSocket payload from clients to server must be masked");
		err.closeCode = 1002;
		throw err;
	}

	// Ensures control frame has a length under 126
	if (buffer[0] & 0x08 && (buffer[1] & 0x7F) > 125) {
		const err = new Error("WebSocket control frame can not have payload lengths longer than 125");
		err.closeCode = 1002;
		throw err;
	}

	// Returns op code
	return buffer[0] & 0x0F;
}

/**
 * The possible WebSocket op codes that can be returned from `getWebSocketOpCode` function
 * text: get text content with getWebSocketTextFrame function
 * binary: no function to get content implemented yet
 * close: get close code with getWebSocketCloseCode, get close reason with getWebSocketCloseReason, if server did not initiate close, server MUST send a close frame back with makeWebSocketCloseFrame
 * ping: server MUST send a pong back to client with makeWebSocketPingResponse. The WebSocket client in browsers can not send pings to the server as far as I know, so this feature might not ever be used.
 * pong: get text content with getWebSocketTextFrame if a payload was sent with the ping (currently sending payload with ping is not implemented)
 */
export const opCodes = {
	text: 0x01,
	binary: 0x02,
	close: 0x08,
	ping: 0x09,
	pong: 0x0A
};

// Gets payload length and byte offset from WebSocket frame
// @todo make sure payload length matches buffer length (offset + 4 + len === buffer.length). If buffer is too short, it should concat next chunk too. But that is compicated without instance.
function getOffsetAndLen(buffer) {
	// Gets payload length
	let len = buffer[1] & 0x7F;

	// Handles lengths up to 125 bytes
	if (len < 126) {
		return [ 2, len ];
	}
	// Handles lengths up to 16 bits
	else if (len === 126) {
		return [ 4, buffer[2] << 8 & buffer[3] ];
	}
	// Handles lengths up to 64 bit
	else {
		// Handles payload larger than 32 bit
		if (!buffer[2] || !buffer[3] || !buffer[4] || !buffer[5]) {
			const err = new Error("WebSocket payload is too large to handle correctly");
			err.response = makeWebSocketCloseFrame(1009);
			throw err;
		}

		return [ 10, buffer[6] << 24 & buffer[7] << 16 & buffer[8] << 8 & buffer[9] ];
	}
}

/**
 * Gets the text content from a WebSocket frame
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {string} Unmasked payload as a string
 */
export function getWebSocketTextPayload(buffer) {
	const [ offset, len ] = getOffsetAndLen(buffer);

	// Unmasks payload to string
	let unmasked = '';
	for (let i = 0; i < len; i++) {
		unmasked += String.fromCharCode(buffer[i + 4 + offset] ^ buffer[i % 4 + offset]);
	}
	return unmasked;
}

/**
 * Gets the binary content from a WebSocket frame
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {ArrayBuffer} Unmasked payload as an array buffer
 */
export function getWebSocketBinaryPayload(buffer) {
	const [ offset, len ] = getOffsetAndLen(buffer);

	// Unmasks payload to an array buffer
	const unmasked = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		unmasked[i] = buffer[i + 4 + offset] ^ buffer[i % 4 + offset];
	}
	return unmasked;
}

/**
 * Gets the close status code for the connection
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {number|undefined} The status code received from the client or undefined if no there is no code
 */
export function getWebSocketCloseCode(buffer) {
	if (!(buffer[1] & 0x7F)) return undefined;
	return ((buffer[6] ^ buffer[2]) << 8) + buffer[7] ^ buffer[3];
}

/**
 * Gets the close reason in plain text for the connection
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {string} Unmasked payload as a string
 */
export function getWebSocketCloseReason(buffer) {
	const len = buffer[1] & 0x7F;
	let unmasked = '';
	for (let i = 2; i < len; i++) {
		unmasked += String.fromCharCode(buffer[i + 6] ^ buffer[i % 4 + 2]);
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

/**
 * Makes a WebSocket text frame containing the payload
 * @param {string} payload The text content to send in the WebSocket frame
 * @returns {ArrayBuffer} The WebSocket frame containing the payload
 * @throws Has a payload larger than 32bit
 */
export function makeWebSocketTextFrame(payload) {
	const arr = [ 0x80 | opCodes.text, ...getLenBytes(payload.length) ];
	for (let i = 0; i < payload.length; i++) {
		arr.push(payload.charCodeAt(i));
	}
	return new Uint8Array(arr);
}

/**
 * Make a WebSocket binary frame containing the payload
 * @param {ArrayBuffer} payload The binary content to send in the WebSocket frame
 * @returns {ArrayBuffer} The WebSocket frame containing the payload
 * @throws Has a payload largeer than 32bit
 */
export function makeWebSocketBinaryFrame(payload) {
	return new Uint8Array([
		0x80 | opCodes.binary,
		...getLenBytes(payload.length),
		...payload
	]);
}

/**
 * Makes a WebSocket close frame
 * @param {number} [code] The close code to send
 * @param {string} [reason] The close reason to send (requires close code)
 * @returns {ArrayBuffer} The close frame
 * @throws Code is ouside range of valid close codes
 * @throws Reason argument is defined but not code argument
 */
export function makeWebSocketCloseFrame(code, reason) {
	const arr = [ 0x88, 0x00 ];

	// Adds close code if available
	if (code != null) {
		if (code > 4999) throw new Error("Invalid WebSocket close code");
		arr[1] += 2;
		arr.push(code >> 8, code & 0xFF);

		// Adds close reason if available
		if (reason != null) {
			if (reason.length > 123) throw new Error("WebSocket close reason too long");
			const len = reason.length;
			arr[1] += len;
			for (let i = 0; i < len; i++) {
				arr.push(reason.charCodeAt(i));
			}
		}
	}
	// Makes it clear why reason was not used
	else if (reason != null) {
		throw new Error("WebSocket close code MUST be defined if reason is to be used");
	}

	return new Uint8Array(arr);
}

/**
 * Makes a WebSocket ping frame
 * @returns {ArrayBuffer} The ping frame
 * @todo Include payload in ping frame
 */
export function makeWebSocketPingFrame() {
	return new Uint8Array([ 0x89, 0x00 ]);
}

/**
 * Makes a WebSocket pong fram in response to a ping request
 * @param {ArrayBuffer} ping The buffer from the ping request
 * @returns {ArrayBuffer} The pong frame
 */
export function makeWebSocketPingResponse(ping) {
	// Creates pong response
	const pong = new Uint8Array(ping.length);
	pong[0] = 0x8A;

	// Transfers content of ping request to pong response
	for (let i = ping.length - 1; i > 0; i--) {
		pong[i] = ping[i];
	}

	return pong;
}
