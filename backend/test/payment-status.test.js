const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRushPayCheckoutResponse } = require('../payment-status');
const { verifyStatusToken } = require('../security');

test('RushPay checkout response token is bound to the provider payment reference', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';

  try {
    const response = buildRushPayCheckoutResponse('rushpay_live_ref', 'widget_session', {
      amount: 25,
      statusToken: 'stale-token',
    });

    assert.equal(response.paymentReference, 'rushpay_live_ref');
    assert.equal(response.widgetSessionToken, 'widget_session');
    assert.equal(response.amount, 25);
    assert.equal(response.isMock, false);
    assert.equal(verifyStatusToken('rushpay_live_ref', response.statusToken), true);
    assert.equal(verifyStatusToken('local_mock_ref', response.statusToken), false);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  }
});
