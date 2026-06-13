const sharp = require('sharp');
const {
  parseBase64ImageDataUrl,
  validateProfilePhotoBuffer,
  PROFILE_PHOTO_MAX_BYTES,
} = require('./security');

const PROFILE_PHOTO_MAX_WIDTH = 800;
const PROFILE_PHOTO_JPEG_QUALITY = 80;

async function compressProfilePhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: PROFILE_PHOTO_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: PROFILE_PHOTO_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

async function prepareProfilePhotoFromDataUrl(image) {
  const parsed = parseBase64ImageDataUrl(image);
  if (!parsed) {
    const err = new Error('Photo must be a JPEG, PNG, or WebP image');
    err.status = 400;
    throw err;
  }

  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!validateProfilePhotoBuffer(buffer, parsed.ext)) {
    const err = new Error(
      `Photo must be a valid image under ${Math.round(PROFILE_PHOTO_MAX_BYTES / (1024 * 1024))}MB`
    );
    err.status = 400;
    throw err;
  }

  const compressed = await compressProfilePhoto(buffer);
  return { buffer: compressed, ext: 'jpg' };
}

function buildProfilePhotoUrl(baseUrl, code, version = Date.now()) {
  const root = baseUrl.replace(/\/$/, '');
  return `${root}/photos/${code}.jpg?v=${version}`;
}

module.exports = {
  PROFILE_PHOTO_MAX_WIDTH,
  PROFILE_PHOTO_JPEG_QUALITY,
  compressProfilePhoto,
  prepareProfilePhotoFromDataUrl,
  buildProfilePhotoUrl,
};
