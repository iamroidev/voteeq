function isPaymentStatusPath(path) {
  return /^\/api\/payment\/status\/[^/]+$/.test(path);
}

function isMaintenanceExemptRequest(req) {
  const method = String(req.method || '').toUpperCase();
  const path = req.path || '';

  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (method === 'POST' && path === '/api/payment/webhook') return true;
  if (method === 'GET' && isPaymentStatusPath(path)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
