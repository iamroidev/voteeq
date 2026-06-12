export function isValidEmail(input) {
  const email = String(input || '').trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getEmailError(input, { required = true } = {}) {
  if (!input || !String(input).trim()) {
    return required ? 'Email is required for your receipt.' : '';
  }
  if (!isValidEmail(input)) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}
