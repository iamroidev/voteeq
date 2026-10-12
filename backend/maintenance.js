function isPaymentStatusPath(path) {
  return typeof path === 'string' && path.startsWith('/api/payment/status/');
}

function isMaintenanceExemptRequest(req) {
  if (!req) return false;

  const method = String(req.method || 'GET').toUpperCase();
  const path = req.path || '';

  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (method === 'POST' && path === '/api/payment/webhook') return true;
  if (method === 'GET' && isPaymentStatusPath(path)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
  isPaymentStatusPath,
};
