function isMaintenanceExemptRequest(req) {
  const method = String(req.method || '').toUpperCase();
  const path = req.path || '';

  if (path === '/health') return true;
  if (method === 'GET' && path === '/api/site-status') return true;
  if (method === 'POST' && path === '/api/payment/webhook') return true;
  if (method === 'GET' && path.startsWith('/api/payment/status/')) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
