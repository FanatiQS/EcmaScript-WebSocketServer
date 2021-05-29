main: main.c
	xxd -i main.js js_code.h
	gcc -o abc main.c /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/JavaScriptCore.tbd
	rm js_code.h

clean:
	rm abc
