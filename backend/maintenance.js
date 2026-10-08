function isMaintenanceExemptPath(path) {
  if (path === '/health') return true;
  if (path === '/api/site-status') return true;
  if (path === '/api/payment/webhook') return true;
  if (path.startsWith('/api/payment/status/')) return true;
  return false;
}

module.exports = {
  isMaintenanceExemptPath,
};
