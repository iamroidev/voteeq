function normalizePath(path) {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function isMaintenanceExemptRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = normalizePath(req.path || req.url);

  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (method === 'POST' && path === '/api/payment/webhook') return true;
  if (method === 'GET' && /^\/api\/payment\/status\/[^/]+$/.test(path)) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
