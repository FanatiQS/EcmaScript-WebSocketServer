'use strict';
/**
 * To upgrade an HTTP connection to WebSocket, start by looking at [isWebSocketUpgrade]{@link module:WebSocket~isWebSocketUpgrade}.
 * <br>
 * To parse WebSocket frames, start by looking at [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}.
 * <br>
 * To construct WebSocket frames, look at [makeWebSocketTextFrame]{@link module:WebSocket~makeWebSocketTextFrame}, [makeWebSocketBinaryFrame]{@link module:WebSocket~makeWebSocketBinaryFrame}, [makeWebSocketCloseFrame]{@link module:WebSocket~makeWebSocketCloseFrame} or [makeWebSocketPingFrame]{@link module:WebSocket~makeWebSocketPingFrame}
 * @module WebSocket
 */

import { makeHttpResponse, makeHttpHeaderResponse } from "./http.js";
import makeAccept from './sha1b64.js';



/**
 * Checks if HTTP request is a WebSocket upgrade.
 * <br><br>
 * If the request is an upgrade, [makeWebSocketUpgradeResponse]{@link module:WebSocket~makeWebSocketUpgradeResponse} can be used to send an upgrade response to the client.
 * <br>
 * When upgrade response is sent, all future data MUST be WebSocket frames. To parse future WebSocket frames, start by calling [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode} to know how to handle the data
 * <br><br>
 * If an error is thrown, the function [makeFailedHttpUpgradeResponse]{@link module:WebSocket~makeFailedHttpUpgradeResponse} can be called with the error object as its only argument to get an HTTP response for that error.
 * @function isWebSocketUpgrade
 * @param {HttpRequest} req The HTTP request object received from calling [parseHttp]{@link module:http~parseHttp} or other HTTP parser with the structure of {@link HttpRequest}
 * @returns {boolean} If the request is a WebSocket upgrade or not
 * @throws Is WebSocket upgrade but method is NOT GET
 * @throws Is WebSocket upgrade but HTTP version is not 1.1 or higher
 * @throws Is WebSocket upgrade but WebSocket version is not 13
 * @throws Is WebSocket upgrade but WebSocket key header is not a string
 */
export function isWebSocketUpgrade(req) {
	// Retuns false for non websocket upgrades
	if (
		typeof req.headers.connection !== 'string' ||
		req.headers.connection.toLowerCase().trim() !== 'upgrade'
	) return false;

	// Only accepts upgrade to WebSocket
	if (
		typeof req.headers.upgrade !== 'string' ||
		req.headers.upgrade.toLowerCase().trim() !== 'websocket'
	) {
		const err = new Error("This WebSocket implementation can not handle HTTP upgrades to anything other than the WebSocket protocol");
		err.code = "INVALID_WS_UPGR";
		throw err;
	}

	// Spec only allows GET requests for upgrade
	if (typeof req.method !== 'string' || req.method.toUpperCase().trim() !== 'GET') {
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
	if (!req.headers['sec-websocket-key']) {
		const err = new Error("Missing WebSocket key");
		err.code = "INVALID_WS_KEY";
		throw err;
	}

	return true;
}

/**
 * Makes an HTTP response indicating the WebSocket upgrade request has failed.
 * @function makeFailedHttpUpgradeResponse
 * @param {Error} err An error from [isWebSocketUpgrade]{@link module:WebSocket~isWebSocketUpgrade} call
 * @returns {string} An HTTP response for the error that occured. The function [stringToBuffer]{@link module:http~stringToBuffer} can be used to convert the string result to a Uint8Array.
 * @throws Error is not from [isWebSocketUpgrade]{@link module:WebSocket~isWebSocketUpgrade} call
 */
export function makeFailedHttpUpgradeResponse(err) {
	switch (err.code) {
		case "INVALID_WS_UPGR": return makeHttpHeaderResponse(426, { Upgrade: "websocket" });
		case "INVALID_METHOD": return makeHttpResponse(400);
		case "INVALID_HTTP_VERSION": return makeHttpResponse(400);
		case "INVALID_WS_VERSION": return makeHttpHeaderResponse(426, { ["Sec-WebSocket-Version"]: 13 });
		case "INVALID_WS_KEY": return makeHttpResponse(400);
		default: throw new Error("No Error or invalid error code");
	}
}

/**
 * Makes an HTTP response indicating the connection has successfully been upgraded to use the WebSocket protocol.
 * @function makeWebSocketUpgradeResponse
 * @param {HttpRequest} req The HTTP request that was confirmed to be an upgraded to the WebSocket protocol by [isWebSocketUpgrade]{@link module:WebSocket~isWebSocketUpgrade}
 * @returns {string} The HTTP response to upgrade the client to use the WebSocket protocol. The function [stringToBuffer]{@link module:http~stringToBuffer} can be used to convert the string result to a Uint8Array.
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
 * Gets the WebSocket op code from a buffer. If it is a Websocket frame, the value is going to match one of the opCodes in [opCodes]{@link module:WebSocket~opCodes}. Read more for the specific opCodes on how handle them.
 * <br><br>
 * If an error is thrown, it should include a closeCode that can be used with [makeWebSocketCloseFrame]{@link module:WebSocket~makeWebSocketCloseFrame} to close the socket.
 * @function getWebSocketOpCode
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {number} The opCode for the WebSocket frame
 * @throws Is a fragmented frame (fragmented frames are not supported right now)
 * @throws Has one or more reserved bits set
 * @throws Payload is not masked
 * @throws Control frame has message longer than 125
 */
export function getWebSocketOpCode(buffer) {
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

	// Validates control frames
	if (buffer[0] & 0x08) {
		// Ensures control frames are not fragmented
		if (!(buffer[0] & 0x80)) {
			const err = new Error("WebSocket control frames can not be fragmented");
			err.closeCode = 1002;
			throw err;
		}

		// Ensures control frames has a length under 126
		if ((buffer[1] & 0x7F) > 125) {
			const err = new Error("WebSocket control frames can not have payload lengths longer than 125");
			err.closeCode = 1002;
			throw err;
		}
	}

	// Returns op code
	return buffer[0];
}

/**
 * The possible WebSocket opCodes that can be returned from [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}. If anything other than any of these opCodes are received, an error should be thrown.
 * @name opCodes
 * @enum
 * @readonly
 * @property {number} text The opCode for a WebSocket text frame. Get the text content by calling [getWebSocketTextPayload]{@link module:WebSocket~getWebSocketTextPayload}.
 * @property {number} binary The opCode for a WebSocket binary frame. Get the binary content by calling [getWebSocketBinaryPayload]{@link module:WebSocket~getWebSocketBinaryPayload}.
 * @property {number} close The opCode for a WebSocket close frame. Get the close code by calling [getWebSocketCloseCode]{@link module:WebSocket~getWebSocketCloseCode}. Get the close reason by calling [getWebSocketCloseReason]{@link module:WebSocket~getWebSocketCloseReason}. If the WebSocket server did not initiate the closing handshake, the server MUST answer the client with a close frame back. A close frame can be created by calling [makeWebSocketCloseFrame]{@link module:WebSocket~makeWebSocketCloseFrame}.
 * @property {number} ping The opCode for a WebSocket ping frame. The WebSocket MUST answer ping frames with a pong response that can be created by calling [makeWebSocketPingResponse]{@link module:WebSocket~makeWebSocketPingResponse} with the ping buffer. If ping frame contains a payload, it can be extracted by using the same functions for getting payload from text or binary frames.
 * @property {number} pong The opCode for a WebSocket pong frame. If pong frame contains a payload, it can be extracted by using the same functions for getting payload from text or binary frames.
 *
 * @property {number} fragmentedText The opCode for a WebSocket text frame that is not the last for the message. Get the text content by calling [getWebSocketTextPayload]{@link module:WebSocket~getWebSocketTextPayload} and buffer it until getting a {@linkcode fragmentedEnd}. If a {@linkcode fragmentedText} or {@linkcode fragmentedBinary} has already been received without getting a {@linkcode fragmentedEnd}, an error should be thrown.
 * @property {number} fragmentedBinary The opCode for a WebSocket binary frame that is not the last for the message. Get the binary content by calling [getWebSocketBinaryPayload]{@link module:WebSocket~getWebSocketBinaryPayload} and buffer it until getting a {@linkcode fragmentedEnd}. If a {@linkcode fragmentedText} or {@linkcode fragmentedBinary} has already been received without getting a {@linkcode fragmentedEnd}, an error should be thrown.
 * @property {number} fragmentedContinue The opCode for a WebSocket frame continuing on a buffered message and is not the last for the message. Call [getWebSocketTextPayload]{@link module:WebSocket~getWebSocketTextPayload} or [getWebSocketBinaryPayload]{@link module:WebSocket~getWebSocketBinaryPayload} to get content and add it to the buffer. If a {@linkcode fragmentedText} or {@linkcode fragmentedBinary} has not been received before getting this opCode, an error should be thrown.
 * @property {number} fragmentedEnd The opCode for a WebSocket frame continuing on a buffered message and is the last buffer for the message. Call [getWebSocketTextPayload]{@link module:WebSocket~getWebSocketTextPayload} or [getWebSocketBinaryPayload]{@link module:WebSocket~getWebSocketBinaryPayload} to get content and add it to the buffer. If a {@linkcode fragmentedText} or {@linkcode fragmentedBinary} has not been received before getting this opCode, an error should be thrown. Since this is the last chunk in the buffered message, the buffer should now be handled the same way a normal {@linkcode opCode.text} or {@linkcode opCode.binary} frame is handled.
 */
export const opCodes = {
	text: 0x81,
	binary: 0x82,
	close: 0x88,
	ping: 0x89,
	pong: 0x8A,
	fragmentedText: 0x01,
	fragmentedBinary: 0x02,
	fragmentedContinue: 0x00,
	fragmentedEnd: 0x80,
};

// Gets payload length and byte offset from WebSocket frame
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
 * Gets the text content from a WebSocket text frame. Check if WebSocket frame is a text frame with [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}.
 * @function getWebSocketTextPayload
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {string} Unmasked WebSocket payload as a string
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
 * Gets the binary content from a WebSocket binary frame. Check if WebSocket frame is a binary frame with [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}.
 * @function getWebSocketBinaryPayload
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {Uint8Array} Unmasked WebSocket payload as an array buffer
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
 * Gets the close status code for the connection. Check if WebSocket frame is a close frame with [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}. More info about the WebSocket close codes can be found at {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent}
 * @function getWebSocketCloseCode
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {number|undefined} The status code received from the client or undefined if there is no code
 */
export function getWebSocketCloseCode(buffer) {
	if (!(buffer[1] & 0x7F)) return undefined;
	return ((buffer[6] ^ buffer[2]) << 8) + buffer[7] ^ buffer[3];
}

/**
 * Gets the close reason in plain text for the connection. Check if WebSocket frame is a close frame with [getWebSocketOpCode]{@link module:WebSocket~getWebSocketOpCode}.
 * @function getWebSocketCloseReason
 * @param {ArrayBuffer} buffer The WebSocket buffer received from a client
 * @returns {string} Unmasked WebSocket payload as a string
 */
export function getWebSocketCloseReason(buffer) {
	const len = buffer[1] & 0x7F;
	let unmasked = '';
	for (let i = 2; i < len; i++) {
		unmasked += String.fromCharCode(buffer[i + 6] ^ buffer[i % 4 + 2]);
	}
	return unmasked || undefined;
}



// Creates WebSocket length bytes for payload
function getLenBytes(len) {
	if (len < 126) return [ len ];
	if (len < 0xffff) return [ 126, (len >> 8), len & 0xff ];
	if (len < 0xffffffff) return [ 127, 0, 0, 0, 0,
		(len >> 24), (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff ];
	throw new Error("Payload length can not be 32 bit or longer");
}

/**
 * Makes a WebSocket text frame containing the payload
 * @function makeWebSocketTextFrame
 * @param {string} payload The text content to send in the WebSocket frame
 * @returns {Uint8Array} The WebSocket frame containing the payload
 * @throws Has a payload larger than 32bit
 */
export function makeWebSocketTextFrame(payload) {
	const arr = [ opCodes.text, ...getLenBytes(payload.length) ];
	for (let i = 0; i < payload.length; i++) {
		arr.push(payload.charCodeAt(i));
	}
	return new Uint8Array(arr);
}

/**
 * Makes a WebSocket binary frame containing the payload
 * @function makeWebSocketBinaryFrame
 * @param {ArrayBuffer} payload The binary content to send in the WebSocket frame
 * @returns {Uint8Array} The WebSocket frame containing the payload
 * @throws Has a payload largeer than 32bit
 */
export function makeWebSocketBinaryFrame(payload) {
	return new Uint8Array([
		opCodes.binary,
		...getLenBytes(payload.length),
		...payload
	]);
}

/**
 * Makes a WebSocket close frame containing the close code and reason
 * @function makeWebSocketCloseFrame
 * @param {number} [code] The close code to send. More info about the WebSocket close codes can be found at {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent}
 * @param {string} [reason] The close reason to send (requires close code to be defined)
 * @returns {Uint8Array} The close frame
 * @throws Code is ouside range of valid close codes
 * @throws Reason argument is defined but not code argument
 */
export function makeWebSocketCloseFrame(code, reason) {
	const arr = [ 0x88, 0x00 ];

	// Adds close code if available
	if (code != null) {
		if (code > 4999 || code < 0) throw new Error("Invalid WebSocket close code");
		arr[1] += 2;
		arr.push(code >> 8, code & 0xFF);

		// Adds close reason if available
		if (reason) {
			if (reason.length > 123) throw new Error("WebSocket close reason too long");
			const len = reason.length;
			arr[1] += len;
			for (let i = 0; i < len; i++) {
				arr.push(reason.charCodeAt(i));
			}
		}
	}
	// Makes it clear why reason was not used
	else if (reason) {
		throw new Error("WebSocket close code MUST be defined if reason is to be used");
	}

	return new Uint8Array(arr);
}

/**
 * Makes a WebSocket ping frame
 * @function makeWebSocketPingFrame
 * @returns {Uint8Array} The ping frame
 * @todo Include payload in ping frame
 */
export function makeWebSocketPingFrame() {
	return new Uint8Array([ 0x89, 0x00 ]);
}

/**
 * Makes a WebSocket pong fram in response to a ping request
 * @function makeWebSocketPingResponse
 * @param {ArrayBuffer} ping The buffer from the ping request
 * @returns {Uint8Array} The pong frame
 */
export function makeWebSocketPingResponse(ping) {
	// Creates pong response
	const len = ping[1] & 0x7F;
	const pong = new Uint8Array(len + 2);
	pong[0] = 0x8A;
	pong[1] = len;

	// Transfers content of ping request to pong response
	for (let i = 0; i < len; i++) {
		pong[i + 2] = ping[i + 4 + 2] ^ ping[i % 4 + 2];
	}

	return pong;
}
