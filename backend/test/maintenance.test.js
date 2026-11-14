const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest, isPaymentStatusPath } = require('../maintenance');

function req(method, path) {
  return { method, path };
}

describe('maintenance exemptions', () => {
  it('keeps health and site status reachable during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('allows payment confirmation paths required after checkout', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_123')), true);
  });

  it('does not expose other API methods or payment endpoints while locked', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/webhook')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/status/rp_123')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/nominees')), false);
  });
});

describe('payment status path matching', () => {
  it('matches status collection and reference paths only', () => {
    assert.equal(isPaymentStatusPath('/api/payment/status'), true);
    assert.equal(isPaymentStatusPath('/api/payment/status/rp_123'), true);
    assert.equal(isPaymentStatusPath('/api/payment/status-extra/rp_123'), false);
  });
});
