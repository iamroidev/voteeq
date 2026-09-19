const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { chargeMobileMoney } = require('../paystack');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('normalizes Ghana mobile money phone before charging Paystack', async () => {
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: true, data: { reference: 'ussd_ref_001' } }),
    };
  };

  await chargeMobileMoney({
    secretKey: 'sk_test_123',
    email: 'customer@voteeq.online',
    amountMinor: 100,
    reference: 'ussd_ref_001',
    phone: '233543210987',
    provider: 'mtn',
  });

  assert.equal(requestBody.mobile_money.phone, '0543210987');
  assert.equal(requestBody.mobile_money.provider, 'mtn');
});
