function isPaymentStatusPath(path) {
  return /^\/api\/payment\/status\/[^/]+$/.test(path);
}

function isMaintenanceExemptRequest(method, path) {
  const normalizedMethod = String(method || '').toUpperCase();

  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (normalizedMethod === 'POST' && path === '/api/payment/webhook') return true;
  if (normalizedMethod === 'GET' && isPaymentStatusPath(path)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
