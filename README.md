# EcmaScript WebSocket and HTTP Server
This is a low level WebSocket and HTTP server side library built using only EcmaScript 2015 features. While there are more fully featured WebSocket servers built specifically for their environments, this library aims to make a WebSocket server that can be implemented anywhere there is javascript with access to a TCP server. This makes it a lot easier to port from one environment to another or to use with a javascript runtime in your own application (only needing to add TCP bindings).

# Usage
To use this library, there needs to be some kind of socket server available for javascript. It can work with TCP sockets or HTTP sockets that have access to the underlying TCP socket.

## Initializing a WebSocket connection
Since a WebSocket connection starts of as an HTTP upgrade, we first need to handle an HTTP request. If you are using TCP data, you first needs to parsed the HTTP request with the function `parseHttp`. That function takes an array buffer as its argument. Technically anything in this library requiring a buffer as its argument can be anything iterable containing the character codes, but a Uint8Array is the most appropriate type. It returns a request object that contains the method, url, http version and headers. If you are getting data from an HTTP server, make sure the data is structured the same way as the request object from `parseHttp`.

If you want to limit connection to same origin only, there is a function to help with that. `isSameOrigin` takes 2 arguments, the request and the current origin. It returns a boolean if the origin is the same.

After this we have to check if the request is a WebSocket upgrade. This is done with the function `isWebSocketUpgrade`, it takes the request object as its arguments and returns a boolean if the request is an upgrade or not. If the request is an upgrade but does not conform to the WebSocket upgrade requirements, it will throw an error. [Add more information about getting HTTP response for errors here]. If the request is not a WebSocket upgrade. You can do whatever you want with it. For TCP sockets, there are functions for creating your own HTTP responses to send back, more info in the next chapter.

If `isWebSocketUpgrade` returned true, you need to send back a response that can be generated with `makeWebSocketUpgradeResponse` and it takes the request object as its argument. This response should be sent to the client and if the TCP socket only takes array buffers, there is a helper function `stringToBuffer` to convert the upgrade response from a string to a buffer. After this response is sent, the client and server must now start using the WebSocket protocol for all further communication.

## Make non-WebSocket HTTP response
For TCP sockets, there are function for making HTTP responses.
* If you want to use an http status code that does not exist in `httpStatusCodes`, you should it yourself so the response gets a reason text.
* If your TCP socket can only write array buffers back, `stringToBuffer` can convert the HTTP response string to an array buffer.
* `makeHttpHtmlResponse` takes an HTML string and puts it in an HTTP response. By default, it uses status code 200 OK but it can be customised with the second argument ().
* `makeHttpHeaderResponse` takes an HTTP status code and an object of headers. An HTTP body can be concatenated on to the returned string as long as the appropriate headers are set.

## Parsing incoming WebSocket data
To parse the WebSocket data, we start by getting the opCode with the function `getWebSocketOpCode` with the buffer from the TCP socket as the argument. This function returns the opCode (all opCodes used can be found in `opCodes`) or throws if the WebSocket frame has malformed or used unsupported features. [Add more information about getting HTTP response for errors here].

### Close
For close frames, there is one things the server MUST do. If the close was initiated by the client (the server did not send a close frame), the server MUST send a close frame back to the client. If the close frame is a response to a server initiated close, the server should close the TCP socket.

### Ping
If a server gets a ping frame, it MUST send back a pong frame. This can easily be created with the `makeWebSocketPingResponse` function. Ping frames can also contain a payload. Not exactly sure what for.

### Pong
This is just a response for a ping request sent to the client.

### Text
This is a text frame and the content can be extracted using the `getWebSocketTextPayload` function.

### Binary
This is a binary frame and the content can be extracted using the `getWebSocketBinaryPayload` function.

## Sending WebSocket data

### Close
Close frames can be created using `makeWebSocketCloseFrame` and can take 2 arguments. The first one is a close code that follows the WebSocket spec for how they are used. The second arguments is a close reason and requires the close code to be set.

Throws error if reason is longer than 125 characters or if close code is outside valid range.

If a close frame is sent, the TCP socket should not be closed until the server receives a close frame back from the server.

### Ping
Ping frames can be created using `makeWebSocketPingFrame` and has no arguments.

### Text
Text frames can be created using `makeWebSocketTextFrame` and it takes a string as its argument.

Throws error if contents length is 32 bit or longer

### Binary
Binary frames can be created using `makeWebSocketBinaryFrame` and it takes an array buffer as its argument.

Throws error if contents length is 32 bit or longer

# Not supported WebSocket features
## HTTP stream
Currently, the HTTP parser only works with the entire HTTP request in the buffer in one shot. There is no support for getting the HTTP request in multiple TCP packets. This is a feature I would like to get working
## Fragmented WebSocket frames
WebSocket frames can be fragmented and split into multiple frames. This feature is not supported in this library and is currently not under consideration. If it is a feature you want, open an issue on Github.
## WebSocket extensions
The WebSocket protocol is built to be extended with extra functions. This is not supported in this library and is currently not under consideration. If it is a feature you want, open an issue on Github.
## WebSocket subprotocols
During the WebSocket handshake, the client and the server can agree on a specific subprotocol to use. This is not supported in this library and is currently not under consideration. If it is a feature you want, open an issue on Github.
## Payload length of 4 294 967 296 or longer
The WebSocket protocol supports payload lengths up to 64 bit values. Unfortunately, javascript clamps its values to 32 bit when doing bit shifting, so the maximum length for payload in this library is 32 bit (4 294 967 296)
## Ping frame payload
Ping frames can currently not be created with a payload. This is mainly because I don't know how it would be used and for what. If it is a feature you want, open an issue on Github.



# The Sha1 and Base64
This library uses modified versions of other libraries for Sha1 and Base64. The functions are modified to only support what is needed for the length and content it is going to be used for. When "warmed up", it is actually faster than the native built-in crypto functions in NodeJS.

# TODO
* Add streaming support for HTTP (multipacket)
* Test error catching in examples
* Make sure http proxies work
* Make sure http filtering works (whatever that is, but it was mentioned in the spec)
* A good way for implementors to be forced to handle control frame correctly and to not send data after socket is closed. This might require a constructor. A constructor approach would be another way of doing it and only using the function should still be valid.
* Should the server close socket on close frame from client? In spec, it said that the initiating peer closes the socket
* Add /doc from jsdoc. Would be great to use github actions.
