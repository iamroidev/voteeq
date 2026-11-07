const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

describe('maintenance exemptions', () => {
  it('allows only health and site status utility endpoints', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/health'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/health/'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/site-status'), true);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/site-status'), false);
  });

  it('allows payment confirmation endpoints during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/webhook'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/status/rp_123'), true);
  });

  it('keeps public and admin routes blocked during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/api/categories'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/admin/login'), false);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/webhook'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/status/rp_123'), false);
  });
});
