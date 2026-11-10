const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

function req(method, path) {
  return { method, path };
}

describe('isMaintenanceExemptRequest', () => {
  it('allows health and site status checks during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('allows payment confirmation routes during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_123')), true);
  });

  it('continues to block public and admin routes during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/nominees')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/admin/login')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/webhook')), false);
  });
});
