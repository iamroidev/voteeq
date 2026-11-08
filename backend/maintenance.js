const PAYMENT_STATUS_PATH_RE = /^\/api\/payment\/status\/[^/]+$/;

function isMaintenanceExemptRequest(method, path) {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').split('?')[0];

  if (normalizedPath === '/health') return true;
  if (normalizedPath === '/api/site-status') return true;
  if (normalizedMethod === 'POST' && normalizedPath === '/api/payment/webhook') return true;
  if (normalizedMethod === 'GET' && PAYMENT_STATUS_PATH_RE.test(normalizedPath)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
