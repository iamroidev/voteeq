function isMaintenanceExemptRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const requestPath = req.path || '';

  if (method === 'GET' && requestPath === '/health') return true;
  if (method === 'GET' && requestPath === '/api/site-status') return true;

  // Payment providers must be able to confirm completed transactions even
  // while the public site is locked.
  if (method === 'POST' && requestPath === '/api/payment/webhook') return true;
  if (method === 'GET' && /^\/api\/payment\/status\/[^/]+$/.test(requestPath)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
