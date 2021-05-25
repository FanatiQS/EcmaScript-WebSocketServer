/*
 * [js-sha1]{@link https://github.com/emn178/js-sha1}
 *
 * @version 0.6.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2017
 * @license MIT
 */

/*
 * and
 */

/**
 * Base64 encode / decode
 * http://www.webtoolkit.info/
 */

'use strict';

const bas64Table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const SHIFT = [24, 16, 8, 0];

export default function sha1(message) {
	// Sha1 hash
	const h = [ 0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0 ];
	const blocks = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ];

	for (let index = message.length - 1; index >= 0; index--) {
		blocks[index >> 2] |= message.charCodeAt(index) << SHIFT[index & 3];
	}

	blocks[15] |= -2147483648;
	sha1Hash(h, blocks);
	blocks[0] = blocks[1] = blocks[2] = blocks[3] =
	blocks[4] = blocks[5] = blocks[6] = blocks[7] =
	blocks[8] = blocks[9] = blocks[10] = blocks[11] =
	blocks[12] = blocks[13] = blocks[14] = blocks[16] = 0;
	blocks[15] = 480;
	sha1Hash(h, blocks);

	const digest = [
		(h[0] >> 24) & 0xFF, (h[0] >> 16) & 0xFF, (h[0] >> 8) & 0xFF,
		h[0] & 0xFF, (h[1] >> 24) & 0xFF, (h[1] >> 16) & 0xFF,
		(h[1] >> 8) & 0xFF, h[1] & 0xFF, (h[2] >> 24) & 0xFF,
		(h[2] >> 16) & 0xFF, (h[2] >> 8) & 0xFF, h[2] & 0xFF,
		(h[3] >> 24) & 0xFF, (h[3] >> 16) & 0xFF, (h[3] >> 8) & 0xFF,
		h[3] & 0xFF, (h[4] >> 24) & 0xFF, (h[4] >> 16) & 0xFF,
		(h[4] >> 8) & 0xFF, h[4] & 0xFF
	];

	// Base64 encode
	let output = "";
	let i = 0;
	while (i < 20) {
		const chr1 = digest[i++];
		const chr2 = digest[i++];
		const chr3 = digest[i++];

		output += bas64Table.charAt(chr1 >> 2) +
			bas64Table.charAt(((chr1 & 3) << 4) | (chr2 >> 4)) +
			bas64Table.charAt(((chr2 & 15) << 2) | (chr3 >> 6)) +
			bas64Table.charAt((chr3 & 63) || 64);
	}
	return output;
};

function sha1Hash(h, blocks) {
	let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
	let f, j, t;

	for(j = 16; j < 80; ++j) {
		t = blocks[j - 3] ^ blocks[j - 8] ^ blocks[j - 14] ^ blocks[j - 16];
		blocks[j] = (t << 1) | (t >>> 31);
	}

	for(j = 0; j < 20; j += 5) {
		f = (b & c) | ((~b) & d);
		t = (a << 5) | (a >>> 27);
		e = t + f + e + 1518500249 + blocks[j] << 0;
		b = (b << 30) | (b >>> 2);

		f = (a & b) | ((~a) & c);
		t = (e << 5) | (e >>> 27);
		d = t + f + d + 1518500249 + blocks[j + 1] << 0;
		a = (a << 30) | (a >>> 2);

		f = (e & a) | ((~e) & b);
		t = (d << 5) | (d >>> 27);
		c = t + f + c + 1518500249 + blocks[j + 2] << 0;
		e = (e << 30) | (e >>> 2);

		f = (d & e) | ((~d) & a);
		t = (c << 5) | (c >>> 27);
		b = t + f + b + 1518500249 + blocks[j + 3] << 0;
		d = (d << 30) | (d >>> 2);

		f = (c & d) | ((~c) & e);
		t = (b << 5) | (b >>> 27);
		a = t + f + a + 1518500249 + blocks[j + 4] << 0;
		c = (c << 30) | (c >>> 2);
	}

	for(; j < 40; j += 5) {
		f = b ^ c ^ d;
		t = (a << 5) | (a >>> 27);
		e = t + f + e + 1859775393 + blocks[j] << 0;
		b = (b << 30) | (b >>> 2);

		f = a ^ b ^ c;
		t = (e << 5) | (e >>> 27);
		d = t + f + d + 1859775393 + blocks[j + 1] << 0;
		a = (a << 30) | (a >>> 2);

		f = e ^ a ^ b;
		t = (d << 5) | (d >>> 27);
		c = t + f + c + 1859775393 + blocks[j + 2] << 0;
		e = (e << 30) | (e >>> 2);

		f = d ^ e ^ a;
		t = (c << 5) | (c >>> 27);
		b = t + f + b + 1859775393 + blocks[j + 3] << 0;
		d = (d << 30) | (d >>> 2);

		f = c ^ d ^ e;
		t = (b << 5) | (b >>> 27);
		a = t + f + a + 1859775393 + blocks[j + 4] << 0;
		c = (c << 30) | (c >>> 2);
	}

	for(; j < 60; j += 5) {
		f = (b & c) | (b & d) | (c & d);
		t = (a << 5) | (a >>> 27);
		e = t + f + e - 1894007588 + blocks[j] << 0;
		b = (b << 30) | (b >>> 2);

		f = (a & b) | (a & c) | (b & c);
		t = (e << 5) | (e >>> 27);
		d = t + f + d - 1894007588 + blocks[j + 1] << 0;
		a = (a << 30) | (a >>> 2);

		f = (e & a) | (e & b) | (a & b);
		t = (d << 5) | (d >>> 27);
		c = t + f + c - 1894007588 + blocks[j + 2] << 0;
		e = (e << 30) | (e >>> 2);

		f = (d & e) | (d & a) | (e & a);
		t = (c << 5) | (c >>> 27);
		b = t + f + b - 1894007588 + blocks[j + 3] << 0;
		d = (d << 30) | (d >>> 2);

		f = (c & d) | (c & e) | (d & e);
		t = (b << 5) | (b >>> 27);
		a = t + f + a - 1894007588 + blocks[j + 4] << 0;
		c = (c << 30) | (c >>> 2);
	}

	for(; j < 80; j += 5) {
		f = b ^ c ^ d;
		t = (a << 5) | (a >>> 27);
		e = t + f + e - 899497514 + blocks[j] << 0;
		b = (b << 30) | (b >>> 2);

		f = a ^ b ^ c;
		t = (e << 5) | (e >>> 27);
		d = t + f + d - 899497514 + blocks[j + 1] << 0;
		a = (a << 30) | (a >>> 2);

		f = e ^ a ^ b;
		t = (d << 5) | (d >>> 27);
		c = t + f + c - 899497514 + blocks[j + 2] << 0;
		e = (e << 30) | (e >>> 2);

		f = d ^ e ^ a;
		t = (c << 5) | (c >>> 27);
		b = t + f + b - 899497514 + blocks[j + 3] << 0;
		d = (d << 30) | (d >>> 2);

		f = c ^ d ^ e;
		t = (b << 5) | (b >>> 27);
		a = t + f + a - 899497514 + blocks[j + 4] << 0;
		c = (c << 30) | (c >>> 2);
	}

	h[0] += a;
	h[1] += b;
	h[2] += c;
	h[3] += d;
	h[4] += e;
};
