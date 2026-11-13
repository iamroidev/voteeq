function isPaymentStatusPath(path) {
  return typeof path === 'string' && path.startsWith('/api/payment/status/') && path.length > '/api/payment/status/'.length;
}

function isMaintenanceExemptRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = req.path || '';

  if (path === '/health' || path === '/api/site-status') {
    return true;
  }

  if (method === 'POST' && path === '/api/payment/webhook') {
    return true;
  }

  if (method === 'GET' && isPaymentStatusPath(path)) {
    return true;
  }

  return false;
}

module.exports = {
  isMaintenanceExemptRequest,
};
