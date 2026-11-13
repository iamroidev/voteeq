const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

function req(method, path) {
  return { method, path };
}

describe('isMaintenanceExemptRequest', () => {
  it('keeps health and site status reachable during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('allows payment confirmation callbacks and status checks during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_123')), true);
  });

  it('continues to block public and non-confirmation payment routes', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/categories')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/status/rp_123')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/webhook')), false);
  });
});
