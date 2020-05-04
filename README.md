This is just the beginnings of a javascript library that is can be used as a WebSocket server and a simple HTTP server.

The idea is to build a pure javascript socket handler that only has simple read and write functionallity.
Since all socket handling is done in javascript, this code can then be used with NodeJS/Deno or any other situation where you can connect a bare bones socket to javascript callbacks.
