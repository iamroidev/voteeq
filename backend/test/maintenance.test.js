const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');
const { generateStatusToken, verifyStatusToken } = require('../security');

describe('maintenance lock exemptions', () => {
  it('allows payment confirmation endpoints while the site is locked', () => {
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/webhook'), true);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/payment/status/rush_ref_123'), true);
  });

  it('keeps unrelated API and admin routes locked', () => {
    assert.equal(isMaintenanceExemptRequest('GET', '/api/nominees'), false);
    assert.equal(isMaintenanceExemptRequest('POST', '/api/payment/status/rush_ref_123'), false);
    assert.equal(isMaintenanceExemptRequest('GET', '/api/admin/audit-logs'), false);
  });
});

describe('payment status tokens', () => {
  it('must be signed for the provider reference returned to the client', () => {
    const originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-payment-status-secret';

    try {
      const provisionalReference = 'v_mock_placeholder';
      const providerReference = 'rushpay_provider_reference';
      const providerToken = generateStatusToken(providerReference);
      const provisionalToken = generateStatusToken(provisionalReference);

      assert.equal(verifyStatusToken(providerReference, providerToken), true);
      assert.equal(verifyStatusToken(providerReference, provisionalToken), false);
    } finally {
      if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalJwtSecret;
      }
    }
  });
});
