#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <JavaScriptCore/JavaScriptCore.h>
#include "./js_code.h"

JSGlobalContextRef ctx;
JSObjectRef write_to_js_obj;
JSValueRef exception;

int server_socket;
int sockets[1024];
int sockets_len = 0;



// Prints error message and exits
void throw(char *msg) {
	printf("Error: %s", msg);
	for (int i = 0; i < sockets_len; i++) {
		close(sockets[i]);
	}
	exit(1);
}



// Adds socket to list for select
void add_socket(int fd) {
	if (sockets_len >= 1024) {
		throw("Reached max sockets for select\n");
	}
	sockets[sockets_len] = fd;
	sockets_len++;
}

// Removes socket from list for select
void remove_socket(int fd) {
	if (close(fd) < 0) {
		throw("Unable to close socket\n");
	}

	for (int i = 0; i < sockets_len; i++) {
		if (sockets[i] != fd) continue;
		sockets[i] = sockets[sockets_len - 1];
		sockets_len--;
	}
}



// Initializes TCP server
void init_server(char addr[], int port) {
	// Creates server socket
	server_socket = socket(AF_INET, SOCK_STREAM, 0);
	if (server_socket < 0) {
		throw("Unable to create servers TCP socket\n");
	}

	// Sets connection address to server
	struct sockaddr_in server_addr;
	server_addr.sin_family = AF_INET;
	server_addr.sin_port = htons(port);
	server_addr.sin_addr.s_addr = inet_addr(addr);

	// Binds server socket to address
	if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
		throw("Unable to bind servers TCP socket\n");
	}

	// Listens for connections to server
	if (listen(server_socket, 1) < 0) {
		throw("Unable to listen to server TCP socket\n");
	}

	// Sets up file descriptor set with server socket
	sockets[0] = server_socket;
	sockets_len = 1;
}

// Gets file descriptor when they get data
int get_socket() {
	while (1) {
		fd_set list;
		int maxfd = 0;
		FD_ZERO(&list);

		for (int i = 0; i < sockets_len; i++) {
			FD_SET(sockets[i], &list);
			if (sockets[i] >= maxfd) maxfd = sockets[i] + 1;
		}

		// Waits until any file descriptor in set gets data
		if (select(maxfd, &list, NULL, NULL, NULL) < 0) {
			throw("Failed during select\n");
		}

		for (int i = 0; i < maxfd; i++) {
			// Searches for socket with data
			if (!FD_ISSET(i, &list)) continue;

			// Adds new connections to server to file descriptor set
			if (i == server_socket) {
				struct sockaddr_in client_addr;
				socklen_t len = sizeof(client_addr);

				const int fd = accept(server_socket, (struct sockaddr*)&client_addr, &len);

				if (fd < 0) {
					throw("Failed accepting new socket\n");
				}

				printf("New socket connection: %i\n", fd);

				// Adds file descriptor to set
				add_socket(fd);

				// Goes back to select
				break;
			}

			// Returns file descriptor
			return i;
		}
	}
}

// Reads data from file descriptor
int read_socket(int fd, char buffer[], size_t buffer_len) {
	const int len = recv(fd, buffer, buffer_len, 0);
	if (len < 0) {
		throw("Failed receiving data from socket\n");
	}

	// Closes socket on no data
	if (len == 0) {
		printf("Closing socket initiated by client: %i\n", fd);
		remove_socket(fd);
	}
	return len;
}

// Sends buffer to socket
void write_socket(int fd, char *buffer, size_t len) {
	if (write(fd, buffer, len) < 0) {
		throw("Unable to send data to socket\n");
	}
}



// Prints a property from a javascript error object
void throw_print(JSObjectRef err, char *propname, char *tail) {
	JSStringRef js_propname = JSStringCreateWithUTF8CString(propname);
	JSValueRef js_value = JSObjectGetProperty(ctx, err, js_propname, NULL);
	JSStringRelease(js_propname);
	JSStringRef js_str = JSValueToStringCopy(ctx, js_value, NULL);
	size_t len = JSStringGetLength(js_str) + 1;
	char buf[len];
	JSStringGetUTF8CString(js_str, buf, len);
	JSStringRelease(js_str);
	fprintf(stderr, "%s%s", buf, tail);
}

// Prints javascript error
void throw_js() {
	JSObjectRef err = JSValueToObject(ctx, exception, NULL);
	throw_print(err, "stack", "\n");
	throw_print(err, "line", " ");
	throw_print(err, "column", "\n");
	throw_print(err, "message", "\n");
	exit(1);
}

// Initialize JavaScript engine and setup writing to it
void init_js(char script[], size_t len) {
	// Null terminates script
	if (script[len - 1] != 10) {
		throw("Last char of script is required to be a LF\n");
	}
	script[len - 1] = '\0';

	// Creates javascript context
	ctx = JSGlobalContextCreate(NULL);

	// Evaluates script in context and saves host-to-js function
	const JSStringRef js_script = JSStringCreateWithUTF8CString(script);
	const JSValueRef write_to_js_value = JSEvaluateScript(ctx, js_script, NULL, NULL, 1, &exception);
	if (exception != NULL) throw_js();
	JSStringRelease(js_script);
	if (!JSValueIsObject(ctx, write_to_js_value)) {
		throw("Javascript code MUST evaluate to a function to send data into javascript, it was not even an object\n");
	}
	write_to_js_obj = JSValueToObject(ctx, write_to_js_value, NULL);
	if (!JSObjectIsFunction(ctx, write_to_js_obj)) {
		throw("Javascript code MUST evaluate to a function to send data into javascript, it was an object but not a function\n");
	}
}

// Writes data to javascript and writes out to
void write_to_js(int fd, char data[], size_t len) {
	// Makes javascript buffer
	const JSObjectRef buffer = JSObjectMakeTypedArray(ctx, kJSTypedArrayTypeUint8Array, len, NULL);
	for (int i = 0; i < len; i++) {
		JSObjectSetPropertyAtIndex(ctx, buffer, i, JSValueMakeNumber(ctx, data[i]), NULL);
	}

	// Makes arguments array
	const JSValueRef args[] = {
		JSValueMakeNumber(ctx, fd),
		(JSValueRef)buffer
	};

	// Write arguments to javascript
	const JSObjectRef arr = JSValueToObject(ctx, JSObjectCallAsFunction(
		ctx,
		write_to_js_obj,
		NULL,
		2,
		args,
		&exception
	), NULL);
	if (exception != NULL) throw_js();
	if (!JSValueIsArray(ctx, arr)) {
		throw("Returned value is not an array\n");
	}

	// Handles all write actions reqested by javascript
	JSObjectRef value;
	int index = 0;
	while ((value = JSValueToObject(ctx, JSObjectGetPropertyAtIndex(ctx, arr, index, NULL), NULL)) != NULL) {
		// Handles invalid return type
		if (!JSValueIsArray(ctx, value)) {
			throw("Element in returned array is not an array\n");
		}

		// Gets file descriptor
		const JSValueRef fd2_value = JSObjectGetPropertyAtIndex(ctx, value, 0, NULL);
		if (!JSValueIsNumber(ctx, fd2_value)) {
			throw("File Descriptor was not a number\n");
		}
		const int fd2 = (int)(JSValueToNumber(ctx, fd2_value, NULL));

		// Gets array buffer
		const JSObjectRef js_buf = JSValueToObject(ctx, JSObjectGetPropertyAtIndex(ctx, value, 1, NULL), NULL);

		// Closes sockets initated by javascript
		if (JSValueIsNull(ctx, js_buf)) {
			printf("Closing socket initiated by server: %i\n", fd2);
			remove_socket(fd2);
		}
		// Handles data from client
		else if (JSValueGetTypedArrayType(ctx, js_buf, NULL) == 3) {
			// Copies array buffer content to c array
			const size_t len2 = JSObjectGetTypedArrayLength(ctx, js_buf, NULL);
			char buf[len2 + 1];
			for (int i = 0; i < len2; i++) {
				buf[i] = (int)(JSValueToNumber(ctx, JSObjectGetPropertyAtIndex(ctx, js_buf, i, NULL), NULL));
			}

			// Writes buffer to fd
			printf("Writing data to: %i\n", fd2);
			write_socket(fd2, buf, len2);
		}
		// Exits on invalid typed array
		else {
			throw("Data was not a Uint8Array or NULL\n");
		}

		index++;
	}
}

//!!
int main(void) {
	// Initialize the javascript engine
	init_js((char*)main_js, main_js_len);

	// Initialize the TCP server
	init_server("127.0.0.1", 3000);
    printf("Server started\n");

	// Continuously gets data from TCP sockets
	while (1) {
		// Gets next socket with data to read
		const int fd = get_socket();

		// Reads data from socket with data
		char buffer[2048];
		size_t len = read_socket(fd, buffer, 2048);

		// Writes data to javascript
		write_to_js(fd, buffer, len);
	}

	// Cleans up
	JSGlobalContextRelease(ctx);
	for (int i = 0; i < sockets_len; i++) {
		close(sockets[i]);
	}

	return 0;
}
