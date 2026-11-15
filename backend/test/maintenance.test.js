const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

describe('isMaintenanceExemptRequest', () => {
  it('allows health and site status checks during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/health'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/site-status'), true);
  });

  it('allows payment confirmation callbacks during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/webhook'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/status/rushpay_ref_123'), true);
  });

  it('continues blocking public and admin API routes during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/api/categories'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/admin/login'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/status/rushpay_ref_123'), false);
  });
});
