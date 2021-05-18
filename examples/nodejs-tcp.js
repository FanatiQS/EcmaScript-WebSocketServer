const {
	isWebSocketUpgrade,
	makeWebSocketUpgradeResponse,
	getWebSocketOpCode,
	opCodes,
	getWebSocketPayload,
	makeWebSocketCloseFrame,
	bufferToString,
	makeWebSocketTextFrame,
	makeWebSocketPingFrame,
	parseHttp,
	makeHttpHtmlResponse,
	makeHttp404Response
} = require('../src/index.js');

const net = require('net');
const crypto = require('crypto');

function makeAccept(key) {
	return crypto.createHash('sha1').update(key).digest('base64');
};

const server = net.createServer((socket) => {
	let state = 0;

	// Listen for HTTP or WebSocket data
	socket.on('data', (data) => {
		// Handle HTTP packets before upgraded to WebSocket
		if (state === 0) {
			const req = parseHttp(data);

			// Upgrade to WebSocket
			if (isWebSocketUpgrade(req)) {
				state = 1;
				socket.write(makeWebSocketUpgradeResponse(req, makeAccept));
			}
			// Use HTTP
			else {
				switch (req.url) {
					case "/": {
						socket.end(makeHttpHtmlResponse(`<script>
						const ws = new WebSocket(location.href.replace('http', 'ws'));
						ws.onopen = function () {
							ws.send('123456');
							setTimeout(() => {
								// ws.close();
							}, 100);
						};
						ws.onmessage = function (event) {
							console.log(event.data);
						}
						ws.onclose = function () {
							console.log(...arguments);
						};
						ws.onerror = function () {
							console.error(...arguments);
						}
						console.log(ws);
						</script>`));
						break;
					}
					default: {
						socket.end(makeHttp404Response());
						break;
					}
				}
			}
		}
		// Handle WebSocket packets
		else {
			switch(getWebSocketOpCode(data)) {
				case opCodes.text: {
					const msg = bufferToString(getWebSocketPayload(data))
					console.log('data', msg);
					// if (msg === 'close') {
					// 	socket.write(makeWebSocketCloseFrame());
					// 	state = 2;
					// }
					// else if (msg === 'ping') {
					// 	socket.write(makeWebSocketPingFrame());
					// }
					// else if (msg === 'message') {
					// 	socket.write(makeWebSocketTextFrame('test'));
					// }
					break;
				}
				case opCodes.close: {
					console.log('close', getWebSocketPayload(data));
					socket.end((state === 1) ? makeWebSocketCloseFrame() : undefined); // Respond with close frame if it was initiated by the client
					state = 3;
					break;
				}
				case opCodes.pong: {
					console.log('pong', getWebSocketPayload(data));
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
