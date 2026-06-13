function normalizeGhanaPhone(input) {
  if (input === null || input === undefined) return null;
  let p = String(input).trim().replace(/[\s-]/g, '');
  if (!p) return null;
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('233')) p = `0${p.slice(3)}`;
  return p;
}

function isValidGhanaPhone(input) {
  const p = normalizeGhanaPhone(input);
  if (!p) return false;
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(p);
}

function validateGhanaPhone(input, { required = true } = {}) {
  if (!input || !String(input).trim()) {
    if (required) {
      return { valid: false, error: 'Ghana mobile number is required (e.g. 0241234567).' };
    }
    return { valid: true, normalized: null };
  }

  const normalized = normalizeGhanaPhone(input);
  if (!isValidGhanaPhone(input)) {
    return {
      valid: false,
      error: 'Enter a valid Ghana mobile number starting with 02x or 05x (10 digits, e.g. 0241234567).',
    };
  }

  return { valid: true, normalized };
}

function getMomoProvider(phone) {
  const norm = normalizeGhanaPhone(phone);
  if (!norm) return 'mtn'; // default fallback
  
  const prefix = norm.slice(0, 3);
  const mtnPrefixes = ['024', '054', '055', '059', '025', '053'];
  const vodPrefixes = ['020', '050'];
  const tgoPrefixes = ['026', '056', '027', '057'];
  
  if (mtnPrefixes.includes(prefix)) return 'mtn';
  if (vodPrefixes.includes(prefix)) return 'vod';
  if (tgoPrefixes.includes(prefix)) return 'tgo';
  return 'mtn'; // default fallback
}

module.exports = {
  normalizeGhanaPhone,
  isValidGhanaPhone,
  validateGhanaPhone,
  getMomoProvider,
};

