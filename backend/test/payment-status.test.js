const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildRushPayCheckoutResponse } = require('../payment-status');
const { generateStatusToken, verifyStatusToken } = require('../security');

describe('buildRushPayCheckoutResponse', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  before(() => {
    process.env.JWT_SECRET = 'test-status-secret';
  });

  after(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('signs status tokens for the provider payment reference stored in the database', () => {
    const provisionalReference = 'v_provisional';
    const paymentReference = 'rp_provider_reference';

    const response = buildRushPayCheckoutResponse({
      paymentReference,
      widgetSessionToken: 'widget_session',
      statusToken: generateStatusToken(provisionalReference),
    });

    assert.equal(response.paymentReference, paymentReference);
    assert.equal(response.widgetSessionToken, 'widget_session');
    assert.equal(response.isMock, false);
    assert.equal(verifyStatusToken(paymentReference, response.statusToken), true);
    assert.equal(verifyStatusToken(provisionalReference, response.statusToken), false);
  });
});
