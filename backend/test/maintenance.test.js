const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');

describe('maintenance exemptions', () => {
  it('allows health and site-status checks', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/health'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/site-status'), true);
  });

  it('allows payment webhooks to complete already-started transactions', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/webhook'), true);
  });

  it('allows token-protected payment status reads', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/status/v_ref_123'), true);
  });

  it('keeps admin and public APIs blocked during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/admin/login'), false);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/nominees'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/votes'), false);
  });
});
