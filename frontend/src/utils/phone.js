export function normalizeGhanaPhone(input) {
  if (input === null || input === undefined) return '';
  let p = String(input).trim().replace(/[\s-]/g, '');
  if (!p) return '';
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('233')) p = `0${p.slice(3)}`;
  return p;
}

export function isValidGhanaPhone(input) {
  const p = normalizeGhanaPhone(input);
  if (!p) return false;
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(p);
}

export function getGhanaPhoneError(input, { required = true } = {}) {
  if (!input || !String(input).trim()) {
    return required ? 'Ghana mobile number is required (e.g. 0241234567).' : '';
  }
  if (!isValidGhanaPhone(input)) {
    return 'Enter a valid Ghana number: 10 digits starting with 02x or 05x.';
  }
  return '';
}
