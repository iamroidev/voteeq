const crypto = require('crypto');

const PIN_PREFIX = 'scrypt:';
const MAX_VOTES_PER_TRANSACTION = 100;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getPinSalt() {
  return process.env.PIN_SALT || process.env.JWT_SECRET || 'voteeq-pin-salt-change-me';
}

function hashPin(pin) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(pin), getPinSalt(), 64, (err, derived) => {
      if (err) reject(err);
      else resolve(`${PIN_PREFIX}${derived.toString('hex')}`);
    });
  });
}

function verifyPin(pin, stored) {
  if (!stored || stored === 'PENDING' || stored.startsWith('PENDING_ACT_')) {
    return Promise.resolve({ valid: false, pending: true });
  }
  if (!stored.startsWith(PIN_PREFIX)) {
    const valid = stored === String(pin);
    return Promise.resolve({ valid, needsRehash: valid });
  }
  const expectedHex = stored.slice(PIN_PREFIX.length);
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(pin), getPinSalt(), 64, (err, derived) => {
      if (err) reject(err);
      else {
        const valid = crypto.timingSafeEqual(derived, Buffer.from(expectedHex, 'hex'));
        resolve({ valid, needsRehash: false });
      }
    });
  });
}

function isPendingActivation(passcode) {
  return passcode === 'PENDING' || (passcode && passcode.startsWith('PENDING_ACT_'));
}

function verifyAdminCredentials(username, password) {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (isProduction()) {
    if (!envUser || !envPass) return false;
    return timingSafeEqualStr(username, envUser) && timingSafeEqualStr(password, envPass);
  }

  if (envUser && envPass) {
    return timingSafeEqualStr(username, envUser) && timingSafeEqualStr(password, envPass);
  }

  return username === 'admin' && password === 'admin123';
}

function generateReference(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function generateStatusToken(reference) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(reference).digest('base64url');
}

function verifyStatusToken(reference, token) {
  if (!token) return false;
  const expected = generateStatusToken(reference);
  if (!expected) return false;
  return timingSafeEqualStr(token, expected);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && !isProduction());
  } catch {
    return false;
  }
}

function parseBase64ImageDataUrl(image) {
  if (!image || typeof image !== 'string') return null;
  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  return { ext, base64: match[2] };
}

const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function validateProfilePhotoBuffer(buffer, ext) {
  if (!buffer || buffer.length < 12 || buffer.length > PROFILE_PHOTO_MAX_BYTES) return false;
  if (ext === 'png') return buffer[0] === 0x89 && buffer[1] === 0x50;
  if (ext === 'jpg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (ext === 'webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function isValidNomineeCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(code);
}

function validateProductionConfig() {
  if (!isProduction()) return;

  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.TURSO_DATABASE_URL) missing.push('TURSO_DATABASE_URL');
  if (!process.env.TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  if (!process.env.ADMIN_USERNAME) missing.push('ADMIN_USERNAME');
  if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

function mockPaymentsAllowed() {
  return !isProduction();
}

module.exports = {
  PIN_PREFIX,
  MAX_VOTES_PER_TRANSACTION,
  isProduction,
  hashPin,
  verifyPin,
  isPendingActivation,
  verifyAdminCredentials,
  generateReference,
  generateStatusToken,
  verifyStatusToken,
  escapeHtml,
  isValidPhotoUrl,
  parseBase64ImageDataUrl,
  validateProfilePhotoBuffer,
  PROFILE_PHOTO_MAX_BYTES,
  isValidNomineeCode,
  validateProductionConfig,
  mockPaymentsAllowed,
  timingSafeEqualStr,
};
