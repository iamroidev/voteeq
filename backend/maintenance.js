function isMaintenanceExemptRequest(method, path) {
  const requestMethod = String(method || '').toUpperCase();
  const requestPath = String(path || '');

  if (requestPath === '/health') return true;
  if (requestPath === '/api/site-status') return true;

  // Payment providers may deliver confirmations after maintenance begins.
  if (requestMethod === 'POST' && requestPath === '/api/payment/webhook') return true;

  // Status checks are protected by per-payment tokens in the route handler.
  if (requestMethod === 'GET' && requestPath.startsWith('/api/payment/status/')) {
    return true;
  }

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
