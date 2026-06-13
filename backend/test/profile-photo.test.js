const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseBase64ImageDataUrl,
  validateProfilePhotoBuffer,
} = require('../security');
const {
  compressProfilePhoto,
  buildProfilePhotoUrl,
  PROFILE_PHOTO_MAX_WIDTH,
} = require('../profile-photo');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('parseBase64ImageDataUrl accepts jpeg data urls', () => {
  const parsed = parseBase64ImageDataUrl('data:image/jpeg;base64,abcd');
  assert.equal(parsed.ext, 'jpg');
  assert.equal(parsed.base64, 'abcd');
});

test('parseBase64ImageDataUrl rejects invalid payloads', () => {
  assert.equal(parseBase64ImageDataUrl('not-an-image'), null);
  assert.equal(parseBase64ImageDataUrl('data:text/plain;base64,YQ=='), null);
});

test('validateProfilePhotoBuffer checks png magic bytes', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(validateProfilePhotoBuffer(pngHeader, 'png'), true);
  assert.equal(validateProfilePhotoBuffer(Buffer.from([1, 2, 3]), 'png'), false);
});

test('compressProfilePhoto outputs jpeg smaller than max width', async () => {
  const out = await compressProfilePhoto(TINY_PNG);
  assert.ok(out.length > 0);
  assert.equal(out[0], 0xff);
  assert.equal(out[1], 0xd8);
  const meta = await require('sharp')(out).metadata();
  assert.ok(meta.width <= PROFILE_PHOTO_MAX_WIDTH);
  assert.equal(meta.format, 'jpeg');
});

test('buildProfilePhotoUrl includes cache-bust version', () => {
  const url = buildProfilePhotoUrl('https://api.voteeq.online', '101', 1234567890);
  assert.equal(url, 'https://api.voteeq.online/photos/101.jpg?v=1234567890');
});
