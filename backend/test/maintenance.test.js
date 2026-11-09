const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

describe('maintenance allowlist', () => {
  it('allows health and site status probes', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/health'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/site-status'), true);
  });

  it('allows provider payment confirmations during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/webhook'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/status/rp_12345'), true);
  });

  it('keeps public and admin routes locked during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/api/categories'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/initialize'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/admin/login'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/status/rp_12345'), false);
  });
});
