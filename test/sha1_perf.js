const sha1 = require('../src/sha1b64.js');

const crypto = require('crypto');
function sha1_node(key) {
	return crypto.createHash('sha1').update(key).digest('base64');
}

for (let i = 0; i < 1000; i++) {
	sha1_node('dGhlIHNhbXBsZSBub25jZQ==' + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
	sha1('dGhlIHNhbXBsZSBub25jZQ==' + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
}


console.time('node');
for (let i = 0; i < 1000; i++) {
	const digest = sha1_node('dGhlIHNhbXBsZSBub25jZQ==' + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
	if (digest !== "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=") throw digest;
}
console.timeEnd('node');

console.time('js');
for (let i = 0; i < 1000; i++) {
	const digest = sha1('dGhlIHNhbXBsZSBub25jZQ==' + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
	if (digest !== "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=") throw digest;
}
console.timeEnd('js');
