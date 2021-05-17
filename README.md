This is a set of HTTP and WebSocket server functions built in pure EcmaScript.
It should be compatible with any JavaScript environment supporting ES6 or later.
For it to work, it needs to get data from a TCP or HTTP socket and be able to write data back to that socket.

Currently it does not support:
* Multipacket HTTP requests (want this to be fixed first)
* Fragmented WebSocket frames
* WebSocket extensions
* WebSocket payload lengths of 32 bit or longer (bit shifting in javascript can not work on number larger than 32 bit)
* Payload for close and ping frames

* HTTP 404 displays blank page
* No support for binary frames (this would be super easy to add though, let me know if anyone wants it)
* No support for responding to ping requests from clients (would be super easy to add)

The purpose of this library is not to make the best WebSocket server library for Node or any specific environment. Instead, the idea is to have a WebSocket server library that works in any environment and only requires accesss to a TCP or HTTP socket.
Since all socket handling is done in javascript, code using this library would therefore be easier to implement in multiple environments and would also act the same in every environment.

For example, this library could be used in both an iOS and an Android app. The native code would only require running the javascript code in a javascript context and creating a socket server.

This readme is a mess and needs ALOT of love.

Functions are documented with JSDoc.