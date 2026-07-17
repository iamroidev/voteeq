async function initializePaystackTransaction({
  secretKey,
  email,
  amountMinor,
  reference,
  callbackUrl,
  metadata = {},
}) {
  const key = String(secretKey || '').trim();
  if (!key) {
    throw new Error('Paystack secret key is not configured');
  }

  const normalizedEmail = String(email || '').trim() || 'customer@voteeq.online';
  const amount = Math.round(Number(amountMinor));
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error('Payment amount must be at least GH₵ 1.00');
  }

  const payload = {
    email: normalizedEmail,
    amount,
    currency: 'GHS',
    reference: String(reference),
    callback_url: String(callbackUrl),
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([field, value]) => [field, value == null ? '' : String(value)])
    ),
  };

  let response;
  try {
    response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Paystack network error:', err);
    throw new Error('Could not reach Paystack. Check your connection and try again.');
  }

  const raw = await response.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Paystack non-JSON response:', response.status, raw.slice(0, 300));
    throw new Error(`Paystack returned an unexpected response (HTTP ${response.status})`);
  }

  if (!response.ok || !parsed.status || !parsed.data) {
    const message = parsed.message || `Paystack rejected the transaction (HTTP ${response.status})`;
    console.error('Paystack init failed:', response.status, parsed);
    throw new Error(message);
  }

  return parsed.data;
}

async function verifyPaystackTransaction(secretKey, reference) {
  const key = String(secretKey || '').trim();
  if (!key) {
    throw new Error('Paystack secret key is not configured');
  }

  const ref = encodeURIComponent(String(reference));
  let response;
  try {
    response = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch (err) {
    console.error('Paystack verify network error:', err);
    throw new Error('Could not reach Paystack to verify payment.');
  }

  const raw = await response.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Paystack verify non-JSON:', response.status, raw.slice(0, 300));
    throw new Error(`Paystack verify returned unexpected response (HTTP ${response.status})`);
  }

  if (!response.ok || !parsed.status) {
    const message = parsed.message || `Paystack verify failed (HTTP ${response.status})`;
    throw new Error(message);
  }

  const data = parsed.data || {};
  return {
    ok: data.status === 'success',
    status: data.status,
    reference: data.reference,
    amount: data.amount,
    data,
  };
}

async function chargeMobileMoney({
  secretKey,
  email,
  amountMinor,
  reference,
  phone,
  provider,
}) {
  const key = String(secretKey || '').trim();
  if (!key) {
    throw new Error('Paystack secret key is not configured');
  }

  const payload = {
    email: email || 'customer@voteeq.online',
    amount: Math.round(Number(amountMinor)),
    currency: 'GHS',
    reference: String(reference),
    mobile_money: {
      phone: String(phone),
      provider: String(provider)
    }
  };

  let response;
  try {
    response = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Paystack charge network error:', err);
    throw new Error('Could not reach Paystack to trigger mobile money charge.');
  }

  const raw = await response.text();
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Paystack charge non-JSON:', response.status, raw.slice(0, 300));
    throw new Error(`Paystack charge returned unexpected response (HTTP ${response.status})`);
  }

  if (!response.ok || !parsed.status) {
    const message = parsed.message || `Paystack charge failed (HTTP ${response.status})`;
    console.error('Paystack charge failed:', response.status, parsed);
    throw new Error(message);
  }

  return parsed.data;
}

function verifyPaystackWebhook(req, signatureHeader) {
  const crypto = require('crypto');
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return false;
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
  return hash === signatureHeader;
}

module.exports = {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  chargeMobileMoney,
  verifyPaystackWebhook,
};

