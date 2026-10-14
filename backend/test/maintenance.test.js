const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isMaintenanceExemptRequest } = require('../maintenance');
const { generateStatusToken, verifyStatusToken } = require('../security');

function req(method, path) {
  return { method, path };
}

describe('maintenance exemptions', () => {
  it('allows health and site-status probes', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/health')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/site-status')), true);
  });

  it('allows payment completion callbacks and token-protected status checks', () => {
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/webhook')), true);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/status/rp_live_123')), true);
  });

  it('does not allow other methods or payment routes through maintenance', () => {
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/webhook')), false);
    assert.equal(isMaintenanceExemptRequest(req('POST', '/api/payment/status/rp_live_123')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/payment/initialize')), false);
    assert.equal(isMaintenanceExemptRequest(req('GET', '/api/admin/registrations')), false);
  });
});

describe('payment status tokens', () => {
  it('only verifies a token against the exact payment reference it was generated for', () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret';
    try {
      const token = generateStatusToken('rp_provider_reference');
      assert.equal(verifyStatusToken('rp_provider_reference', token), true);
      assert.equal(verifyStatusToken('v_provisional_reference', token), false);
    } finally {
      if (previousSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = previousSecret;
      }
    }
  });
});
