function isMaintenanceExemptRequest(method, path) {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').replace(/\/+$/, '') || '/';

  if (normalizedMethod === 'GET' && normalizedPath === '/health') return true;
  if (normalizedMethod === 'GET' && normalizedPath === '/api/site-status') return true;
  if (normalizedMethod === 'POST' && normalizedPath === '/api/payment/webhook') return true;
  if (normalizedMethod === 'GET' && normalizedPath.startsWith('/api/payment/status/')) return true;

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
