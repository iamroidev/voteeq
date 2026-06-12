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

  const normalizedEmail = String(email || '').trim() || 'customer@voteeq.com';
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

module.exports = {
  initializePaystackTransaction,
};
