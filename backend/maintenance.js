function isPaymentStatusPath(path) {
  return /^\/api\/payment\/status\/[^/]+$/.test(path);
}

function isMaintenanceExemptRequest(req) {
  if (req.path === '/health') return true;
  if (req.path === '/api/site-status') return true;
  if (req.method === 'POST' && req.path === '/api/payment/webhook') return true;
  if (req.method === 'GET' && isPaymentStatusPath(req.path)) return true;
  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
  isPaymentStatusPath,
};
