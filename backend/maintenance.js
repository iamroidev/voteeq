const PAYMENT_STATUS_PATH = /^\/api\/payment\/status\/[^/]+$/;

function isMaintenanceExemptPath(path, method = 'GET') {
  const normalizedMethod = String(method || 'GET').toUpperCase();

  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (normalizedMethod === 'POST' && path === '/api/payment/webhook') return true;
  if (normalizedMethod === 'GET' && PAYMENT_STATUS_PATH.test(path)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptPath,
};
