const {
	isWebSocketUpgrade,
	makeWebSocketUpgradeResponse,
	getWebSocketOpCode,
	opCodes,
	getWebSocketTextPayload,
	makeWebSocketCloseFrame,
	bufferToString,
	makeWebSocketTextFrame,
	makeWebSocketPingFrame,
	getWebSocketCloseCode,
	getWebSocketCloseReason
} = require('../src/index.js');

const http = require('http');
const crypto = require('crypto');

function makeAccept(key) {
	return crypto.createHash('sha1').update(key).digest('base64');
};



const server = http.createServer((req, res) => {
	switch (req.url) {
		case "/": {
			res.end(`<script>
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
			</script>`);
			break;
		}
		default: {
			res.statusCode = 404;
			res.end("404");
			break;
		}
	}
});

server.on('upgrade', (req, socket) => {
	let done = false;

	// Catches HTTP errors for upgrade request
	isWebSocketUpgrade(req);

	// Listen for websocket data
	socket.on('data', (data) => {
		switch(getWebSocketOpCode(data)) {
			case opCodes.text: {
				const msg = getWebSocketTextPayload(data);
				console.log('data', msg);

				if (msg === 'close') {
					socket.write(makeWebSocketCloseFrame(4999, "test"));
					done = true;
				}
				else if (msg === 'ping') {
					socket.write(makeWebSocketPingFrame());
				}
				else if (msg === 'message') {
					socket.write(makeWebSocketTextFrame('test'));
				}

				break;
			}
			case opCodes.close: {
				console.log('close', getWebSocketCloseCode(data), getWebSocketCloseReason(data));
				socket.end((!done) ? makeWebSocketCloseFrame() : undefined); // Respond with close frame if it was initiated by the client
				break;
			}
			case opCodes.pong: {
				console.log('pong', getWebSocketTextPayload(data));
				break;
			}
			case opCode.ping: {
				console.log('Got ping request');
				break;
			}
			default: {
				console.log(data);
			}
		}
	});

	// Listen for tcp socket close
	socket.on('close', () => {
		console.log('tcp close');
		done = true;
	});

	// Send HTTP upgrade to websocket
	socket.write(makeWebSocketUpgradeResponse(req, makeAccept));

});

server.listen(3000);
