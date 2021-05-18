const {
	isWebSocketUpgrade,
	makeWebSocketUpgradeResponse,
	getWebSocketOpCode,
	opCodes,
	getWebSocketTextPayload,
	makeWebSocketCloseFrame,
	bufferToString,
	makeWebSocketTextFrame,
	makeWebSocketPingFrame
} = require('../src/index.js');

const http = require('http');
const crypto = require('crypto');

function makeAccept(key) {
	return crypto.createHash('sha1').update(key).digest('base64');
};

const server = http.createServer((req, res) => {
	// Upgrade to websocket
	if (isWebSocketUpgrade(req)) {
		let state = 1;

		// Listen for websocket data
		res.socket.on('data', (data) => {
			switch(getWebSocketOpCode(data)) {
				case opCodes.text: {
					const msg = getWebSocketTextPayload(data);
					console.log('data', msg);
					// if (msg === 'close') {
					// 	req.socket.write(makeWebSocketCloseFrame());
					// 	state = 2;
					// }
					// else if (msg === 'ping') {
					// 	req.socket.write(makeWebSocketPingFrame());
					// }
					// else if (msg === 'message') {
					// 	req.socket.write(makeWebSocketTextFrame('test'));
					// }
					break;
				}
				case opCodes.close: {
					console.log('close', getWebSocketTextPayload(data));
					req.socket.end((state === 1) ? makeWebSocketCloseFrame() : undefined); // Respond with close frame if it was initiated by the client
					state = 3;
					break;
				}
				case opCodes.pong: {
					console.log('pong', getWebSocketTextPayload(data));
					break;
				}
				default: {
					console.log(data);
				}
			}
		});

		// Listen for tcp socket close
		res.socket.on('close', () => {
			console.log('tcp close');
			state = 3;
		});

		// Send HTTP upgrade to websocket
		res.socket.write(makeWebSocketUpgradeResponse(req, makeAccept));
	}
	// Use HTTP
	else {
		switch (req.url) {
			case "/": {
				res.end(`<script>
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
				</script>`);
				break;
			}
			default: {
				res.statusCode = 404;
				res.end(`404`);
				break;
			}
		}
	}
});

server.listen(3000);
