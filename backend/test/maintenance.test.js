const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptPath } = require('../maintenance');

describe('isMaintenanceExemptPath', () => {
  it('allows health and site status checks during maintenance', () => {
    assert.equal(isMaintenanceExemptPath('/health'), true);
    assert.equal(isMaintenanceExemptPath('/api/site-status'), true);
  });

  it('allows payment finalization endpoints during maintenance', () => {
    assert.equal(isMaintenanceExemptPath('/api/payment/webhook'), true);
    assert.equal(isMaintenanceExemptPath('/api/payment/status/paystack_ref_123'), true);
  });

  it('continues to block checkout and admin endpoints during maintenance', () => {
    assert.equal(isMaintenanceExemptPath('/api/payment/initialize'), false);
    assert.equal(isMaintenanceExemptPath('/api/admin/login'), false);
    assert.equal(isMaintenanceExemptPath('/api/nominees'), false);
  });
});
