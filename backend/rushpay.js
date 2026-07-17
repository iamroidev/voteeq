const crypto = require('crypto');

const RUSHPAY_API_BASE = 'https://core.rushpay.cash/api/v1';

/**
 * Create a payment on RushPay
 */
async function createRushPayPayment({ amount, description, callbackUrl, metadata = {} }) {
  const apiKey = process.env.RUSHPAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUSHPAY_API_KEY is not configured in .env file.');
  }

  const url = `${RUSHPAY_API_BASE}/merchant/payments/create`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(amount),
      description,
      callback_url: callbackUrl,
      metadata,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to create payment on RushPay');
  }

  return data.data; // contains payment_reference, status, amount, currency
}

/**
 * Generate a widget session for an existing payment reference
 */
async function createRushPayWidgetSession(paymentReference) {
  const apiKey = process.env.RUSHPAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUSHPAY_API_KEY is not configured in .env file.');
  }

  const url = `${RUSHPAY_API_BASE}/merchant/payments/widget-session`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      payment_reference: paymentReference,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to create RushPay widget session');
  }

  return data.data; // contains widget_session_token
}

/**
 * Verify RushPay Webhook signature
 */
function verifyRushPayWebhook(req, signatureHeader) {
  const webhookSecret = process.env.RUSHPAY_WEBHOOK_SECRET || process.env.RUSHPAY_API_KEY;
  if (!webhookSecret) {
    return false;
  }

  // Support both SHA-256 and SHA-512 signatures depending on what RushPay uses
  const rawBody = req.rawBody || '';
  
  const computedSha512 = crypto
    .createHmac('sha512', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const computedSha256 = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Verify using safe comparison
  try {
    const signatureBuffer = Buffer.from(signatureHeader, 'hex');
    
    const computedSha512Buffer = Buffer.from(computedSha512, 'hex');
    const computedSha256Buffer = Buffer.from(computedSha256, 'hex');

    const match512 = crypto.timingSafeEqual(computedSha512Buffer, signatureBuffer);
    const match256 = crypto.timingSafeEqual(computedSha256Buffer, signatureBuffer);

    return match512 || match256;
  } catch (e) {
    // If buffers are of different sizes, timingSafeEqual will throw
    return computedSha512 === signatureHeader || computedSha256 === signatureHeader;
  }
}

/**
 * Query payment status from RushPay
 */
async function verifyRushPayTransaction(paymentReference) {
  const apiKey = process.env.RUSHPAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUSHPAY_API_KEY is not configured in .env file.');
  }

  // We query the status of the payment reference
  const url = `${RUSHPAY_API_BASE}/merchant/payments/status/${paymentReference}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    if (response.status === 404) {
      // Fallback path check
      const altUrl = `${RUSHPAY_API_BASE}/merchant/payments/${paymentReference}`;
      const altResponse = await fetch(altUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });
      const altData = await altResponse.json();
      if (altResponse.ok && altData.success) {
        return altData.data;
      }
    }
    throw new Error(data.error || 'Failed to query payment status from RushPay');
  }

  return data.data; // contains status
}

module.exports = {
  createRushPayPayment,
  createRushPayWidgetSession,
  verifyRushPayWebhook,
  verifyRushPayTransaction,
};
