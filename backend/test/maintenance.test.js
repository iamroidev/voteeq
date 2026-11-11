const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

function req(method, path) {
  return { method, path };
}

describe('isMaintenanceExemptRequest', () => {
  it('allows health and site status checks', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('allows payment confirmation routes needed after checkout', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_ref_123')), true);
  });

  it('keeps other API and admin routes locked', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/webhook')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/status/rp_ref_123')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/categories')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/admin/login')), false);
  });
});
