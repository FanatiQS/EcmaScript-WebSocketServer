const {
	parseHttp,
	makeHttpHtmlResponse,
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
} = require('../src/index.js');

const net = require('net');



const server = net.createServer((socket) => {
	let state = 0;

	// Listen for HTTP or WebSocket data
	socket.on('data', (data) => {
		// Handle HTTP packets before upgraded to WebSocket
		if (state === 0) {
			const req = parseHttp(data);

			let isWebSocket;
			try {
				isWebSocket = isWebSocketUpgrade(req);
			}
			catch (err) {
				socket.end(makeFailedHttpUpgradeResponse(err));
				return;
			}

			// Upgrade to WebSocket
			if (isWebSocket) {
				state = 1;
				socket.write(makeWebSocketUpgradeResponse(req));
			}
			// Use HTTP
			else {
				switch (req.url) {
					case "/": {
						socket.end(makeHttpHtmlResponse(`<script>
						const ws = new WebSocket(location.href.replace('http', 'ws'));
						ws.onopen = function () {
							console.log('open');
							ws.send('123456');
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
						</script>`));
						break;
					}
					default: {
						socket.end(makeHttpHtmlResponse("Error 404", 404));
						break;
					}
				}
			}
		}
		// Handle WebSocket packets
		else {
			let opCode;
			try {
				opCode = getWebSocketOpCode(data);
			}
			catch (err) {
				socket.write(makeWebSocketCloseFrame(err.closeCode));
				return;
			}

			switch (opCode) {
				case opCodes.text: {
					const msg = getWebSocketTextPayload(data);
					console.log('text', msg);

					if (msg === 'close') {
						socket.write(makeWebSocketCloseFrame(4999, "test"));
						state = 2;
					}
					else if (msg === 'ping') {
						socket.write(makeWebSocketPingFrame());
					}
					else if (msg === 'message') {
						socket.write(makeWebSocketTextFrame('test'));
					}
					else if (msg === 'binary') {
						socket.write(makeWebSocketBinaryFrame(new Uint8Array([ 48, 49, 50 ])));
					}

					break;
				}
				case opCodes.binary: {
					const buffer = getWebSocketBinaryPayload(data);
					console.log('binary', buffer);
					break;
				}
				case opCodes.close: {
					console.log('close', getWebSocketCloseCode(data), getWebSocketCloseReason(data));
					socket.end((state === 1) ? makeWebSocketCloseFrame() : undefined); // Respond with close frame if it was initiated by the client
					break;
				}
				case opCodes.pong: {
					console.log('pong', getWebSocketTextPayload(data));
					break;
				}
				case opCode.ping: {
					console.log('Got ping request');
					socket.write(makeWebSocketPingResponse(data));
					break;
				}
				default: {
					console.log(data);
				}
			}
		}
	});

	// Listen for tcp socket close
	socket.on('close', () => {
		console.log('tcp close');
		if (state !== 0) state = 3;
	});
});

server.listen(3000);
