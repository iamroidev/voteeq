const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { generateStatusToken, verifyStatusToken } = require('../security');

describe('payment status tokens', () => {
  const previousSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-status-secret';
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });

  it('is bound to the exact payment reference being checked', () => {
    const token = generateStatusToken('rp_provider_ref_123');

    assert.equal(verifyStatusToken('rp_provider_ref_123', token), true);
    assert.equal(verifyStatusToken('v_temporary_ref_456', token), false);
  });
});
