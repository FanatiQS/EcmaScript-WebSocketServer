This is a set of HTTP and WebSocket server functions built in pure EcmaScript.
It should be compatible with any JavaScript environment supporting ES6 or later.
For it to work, it needs to get data from a TCP or HTTP socket and be able to write data back to that socket.

# Currently it does not support:
* Multipacket HTTP requests (want this to be fixed first, how are http requests even split into multiple tcp packets?)
* Fragmented WebSocket frames
* WebSocket extensions
* WebSocket protocols
* WebSocket payload lengths of 32 bit or longer (bit shifting in javascript can not work on number larger than 32 bit)
* Payload for making ping frames

The purpose of this library is not to make the best WebSocket server library for Node or any specific environment. Instead, the idea is to have a WebSocket server library that works in any environment and only requires accesss to a TCP or HTTP socket.
Since all socket handling is done in javascript, code using this library would therefore be easier to implement in multiple environments and would also act the same in every environment.

For example, this library could be used in both an iOS and an Android app. The native code would only require running the javascript code in a javascript context and creating a socket server.

This readme is a mess and needs ALOT of love.

Functions are documented with JSDoc.

# The Sha1 and Base64
This library uses modified versions of other libraries for Sha1 and Base64. The functions are modified to only support what is needed for the length and content it is going to be used for. When "warmed up", it is actually faster than the built-in crypto functions in NodeJS.

# todo
* Add Error catching in examples
* Make sure http proxies work
* Make sure http filtering works (whatever that is, but it was mentioned in the spec)
* Host is a required http header but i dont think it would need to interact with the http parser or websocket system
* A good way for implementors to be forced to handle control frame correctly and to not send data after socket is closed. This might require a constructor. A constructor approach would be another way of doing it and only using the function should still be valid.
* Should the server close socket on close frame from client? In spec, it said that the initiating peer closes the socket
* Add /doc from jsdoc. Would be great to use github actions.
