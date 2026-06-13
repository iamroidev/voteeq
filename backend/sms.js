require('dotenv').config();

/**
 * Normalizes phone number to Ghana international format (e.g., 233241234567)
 */
function toGhanaInternational(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/[\s-+]/g, '');
  if (clean.startsWith('233')) return clean;
  if (clean.startsWith('0')) {
    return `233${clean.slice(1)}`;
  }
  return `233${clean}`;
}

/**
 * Send SMS using Arkesel Gateway API
 */
async function sendSMS(to, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = process.env.ARKESEL_SENDER_ID || 'Voteeq';
  const recipient = toGhanaInternational(to);

  if (!recipient) {
    console.warn('SMS failed: Invalid phone number recipient');
    return false;
  }

  const logPrefix = `[SMS -> ${recipient}]`;

  if (!apiKey) {
    console.warn(`${logPrefix} ARKESEL_API_KEY not configured. SMS content: "${message}"`);
    return false;
  }

  try {
    const payload = {
      sender,
      message,
      recipients: [recipient]
    };

    console.log(`${logPrefix} Sending SMS via Arkesel...`);
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const raw = await response.text();
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      // Ignored
    }

    if (!response.ok || parsed.status !== 'success') {
      console.error(`${logPrefix} Arkesel API error (HTTP ${response.status}):`, parsed);
      return false;
    }

    console.log(`${logPrefix} SMS sent successfully. Message ID: ${parsed.messageId || 'N/A'}`);
    return true;
  } catch (err) {
    console.error(`${logPrefix} Failed to send SMS:`, err.message);
    return false;
  }
}

module.exports = {
  sendSMS,
  toGhanaInternational
};
