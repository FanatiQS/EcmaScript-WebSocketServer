function sha1b64_nodejs(key) {
	return crypto.createHash('sha1').update(key).digest('base64');
};
