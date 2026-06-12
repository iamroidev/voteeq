const http = require('http');

function initializePaystackTransaction({ secretKey, email, amountMinor, reference, callbackUrl, metadata }) {
  return new Promise((resolve, reject) => {
    const paystackPayload = JSON.stringify({
      email,
      amount: amountMinor,
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      metadata,
    });

    const options = {
      hostname: 'api.paystack.co',
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(paystackPayload),
      },
    };

    const paystackReq = http.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => { data += chunk; });
      paystackRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status && parsed.data) {
            resolve(parsed.data);
          } else {
            reject(new Error(parsed.message || 'Paystack initialization failed'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Paystack response'));
        }
      });
    });

    paystackReq.on('error', (err) => {
      reject(err);
    });

    paystackReq.write(paystackPayload);
    paystackReq.end();
  });
}

module.exports = {
  initializePaystackTransaction,
};
