function isMaintenanceExemptRequest(method, path) {
  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (method === 'POST' && path === '/api/payment/webhook') return true;
  if (method === 'GET' && /^\/api\/payment\/status\/[^/]+$/.test(path)) return true;
  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
