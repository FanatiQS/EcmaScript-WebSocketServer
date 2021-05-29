import {
	parseHttp,
	makeHttpHtmlResponse
} from '../../src/http.js';

import {
	isWebSocketUpgrade,
	makeWebSocketUpgradeResponse,
	makeFailedHttpUpgradeResponse,
	getWebSocketOpCode,
	opCodes,
	getWebSocketTextPayload,
	getWebSocketBinaryPayload,
	getWebSocketCloseCode,
	getWebSocketCloseReason,
	makeWebSocketTextFrame,
	makeWebSocketBinaryFrame,
	makeWebSocketCloseFrame,
	makeWebSocketPingFrame,
	makeWebSocketPingResponse
} from "../../src/websocket.js";



const sockets = {};

function handleData(fd, buffer) {
	// Handles closing sockets not initiated by javascript
	if (!buffer.length) {
		if (sockets[fd]) delete sockets[fd];
		return [
			[ 0, stringToBuffer("TCP closed\n") ]
		];
	}

	// Handles HTTP requests
	if (!sockets[fd]) {
		const req = parseHttp(buffer);

		let isWebSocket;
		try {
			isWebSocket = isWebSocketUpgrade(req);
		}
		catch (err) {
			return [
				[ fd, stringToBuffer(makeFailedHttpUpgradeResponse(err)) ]
			];
		}

		// Upgrade to WebSocket
		if (isWebSocket) {
			sockets[fd] = 1;
			return [
				[ fd, stringToBuffer(makeWebSocketUpgradeResponse(req)) ]
			];
		}

		// Use HTTP
		switch (req.url) {
			case "/": {
				return [ [ fd, stringToBuffer(makeHttpHtmlResponse(`<script>
				const ws = new WebSocket(location.href.replace('http', 'ws'));
				ws.onopen = function () {
					console.log('open');
					// ws.send('123456');
				};
				ws.onmessage = function (event) {
					console.log('message', event.data);
				}
				ws.onclose = function () {
					console.log('close', ...arguments);
				};
				ws.onerror = function () {
					console.error('error', ...arguments);
				}
				console.log(ws);
				</script>`)) ] ];
			}
			default: {
				return [ [ fd, stringToBuffer(makeHttpHtmlResponse("Error 404", 404)) ] ];
			}
		}
	}

	// Gets opCode for WebSocket frame
	let opCode;
	try {
		opCode = getWebSocketOpCode(buffer);
	}
	catch (err) {
		return [
			[ fd, makeWebSocketCloseFrame(err.closeCode) ]
		];
	}

	switch (opCode) {
		// Echoes message back to client as well as prints it to the console
		case opCodes.text: {
			const msg = getWebSocketTextPayload(buffer);
			return [
				[ fd, makeWebSocketTextFrame(msg) ],
				[ 0, stringToBuffer(msg + '\n') ]
			];
		}
		// Handles required close event
		case opCodes.close: {
			if (sockets[fd] === 1) {
				sockets[fd] = 3;
				return [
					[ fd, makeWebSocketCloseFrame() ]
				];
			}
			else {
				delete sockets[fd];
				return [
					[ fd, null ]
				];
			}
		}
		// Handles required ping event
		case opCode.ping: {
			return [ [ fd, makeWebSocketPingResponse(data) ] ];
			break;
		}
	}

	return [];
};

// Evaluates to host-to-javascipt function for host
handleData;
