const http = require('./http.js');
const websocket = require('./websocket.js');

module.exports = {
	...http,
	...websocket
};