const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

function req(method, path) {
  return { method, path };
}

describe('maintenance allowlist', () => {
  it('keeps health and site status reachable', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('keeps payment confirmation endpoints reachable', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rushpay_ref_123')), true);
  });

  it('continues blocking checkout and admin endpoints', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/initialize')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/admin/login')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/admin/overview')), false);
  });

  it('does not allow mutating the token-protected status endpoint', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/status/rushpay_ref_123')), false);
  });
});
