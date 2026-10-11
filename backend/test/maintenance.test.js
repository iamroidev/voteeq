const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptPath } = require('../maintenance');

describe('isMaintenanceExemptPath', () => {
  it('allows health and site status probes', () => {
    assert.equal(isMaintenanceExemptPath('/health', 'GET'), true);
    assert.equal(isMaintenanceExemptPath('/api/site-status', 'GET'), true);
  });

  it('allows provider webhooks and signed payment status checks during maintenance', () => {
    assert.equal(isMaintenanceExemptPath('/api/payment/webhook', 'POST'), true);
    assert.equal(isMaintenanceExemptPath('/api/payment/status/rushpay_123', 'GET'), true);
  });

  it('keeps normal public and admin API routes locked', () => {
    assert.equal(isMaintenanceExemptPath('/api/categories', 'GET'), false);
    assert.equal(isMaintenanceExemptPath('/api/admin/login', 'POST'), false);
    assert.equal(isMaintenanceExemptPath('/api/payment/webhook', 'GET'), false);
    assert.equal(isMaintenanceExemptPath('/api/payment/status/rushpay_123/extra', 'GET'), false);
  });
});
