const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');
const { generateStatusToken, verifyStatusToken } = require('../security');

function req(method, path) {
  return { method, path };
}

describe('maintenance exemptions', () => {
  it('allows payment confirmation routes through the maintenance lock', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_live_ref_001')), true);
  });

  it('keeps public and admin APIs locked during maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/categories')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/admin/login')), false);
  });
});

describe('payment status tokens', () => {
  it('are valid only for the exact persisted payment reference', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'payment-status-test-secret';

    try {
      const providerReference = 'rp_live_reference_001';
      const staleLocalReference = 'tix_local_reference_001';
      const staleToken = generateStatusToken(staleLocalReference);
      const providerToken = generateStatusToken(providerReference);

      assert.equal(verifyStatusToken(providerReference, staleToken), false);
      assert.equal(verifyStatusToken(providerReference, providerToken), true);
    } finally {
      if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousSecret;
      }
    }
  });
});
