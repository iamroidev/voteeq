const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateStatusToken, verifyStatusToken } = require('../security');

describe('payment status tokens', () => {
  let previousJwtSecret;

  before(() => {
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-status-token-secret';
  });

  after(() => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  it('only verifies for the payment reference used to generate it', () => {
    const rushPayReference = 'rp_live_reference_001';
    const provisionalReference = 'v_local_reference_001';

    const token = generateStatusToken(rushPayReference);

    assert.equal(verifyStatusToken(rushPayReference, token), true);
    assert.equal(verifyStatusToken(provisionalReference, token), false);
  });
});
