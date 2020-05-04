const net = require('net');
const { createHash } = require('crypto');
const Request = require('./http-parser.js');
const body = require('fs').readFileSync('../teleprompter-test/head.html').toString();
Request.hashWebSocketKey = function (str) {
	return createHash('sha1').update(str).digest('base64');
};


const server = net.createServer((socket) => {
	const onData = createSocket((open, chunk) => {
		if (!open) socket.destroy();
		else socket.write(chunk, 'binary');
	});
	socket.on('data', (chunk) => {
		onData(chunk);
	});
});
server.listen(80);



function createSocket(writeData) {
	const req = new Request();
	return (chunk) => onData(req, chunk, writeData);
}

function onData(req, chunk, writeData) {
	if (!req.parse(chunk)) return;
	if (req.method !== 'GET') throw new Error("Only supports methods [GET]");
	if (req.headers.Connection.trim() === 'Upgrade') {
		writeData(true, "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-Websocket-Accept: " + Request.hashWebSocketKey(req.headers['Sec-WebSocket-Key'].trim() + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11') + "\r\n\r\n");
		setInterval(() => {
			const data = "banana\n";
			const frame = String.fromCharCode(129, data.length) + data;
			writeData(true, frame);
		}, 1000);
	}
	else {
		writeData(true, "HTTP/1.1 200 OK\r\nConnection: Closed\r\nContent-Type: text/html\r\nContent-Length: " + body.length + "\r\n\r\n" + body);
		writeData(false);
	}
}
