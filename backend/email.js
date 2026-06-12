function isValidEmail(input) {
  const email = String(input || '').trim().toLowerCase();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || 'Voteeq <onboarding@resend.dev>';
}

async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const raw = await response.text();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { message: raw };
  }

  if (!response.ok) {
    console.error('Resend error:', response.status, parsed);
    throw new Error(parsed.message || `Resend failed (HTTP ${response.status})`);
  }

  return { sent: true, id: parsed.id };
}

function buildVoteReceiptHtml({ nomineeName, voteCount, amountGHS, reference, phone }) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1a1918;">
      <h1 style="font-size: 22px; font-weight: 400; margin-bottom: 8px;">Voteeq payment receipt</h1>
      <p style="color: #6b6560; font-size: 14px; margin-top: 0;">Thank you. Your vote payment is confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b6560;">Nominee</td><td style="padding: 8px 0; text-align: right;"><strong>${nomineeName}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Votes</td><td style="padding: 8px 0; text-align: right;">${voteCount}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Amount</td><td style="padding: 8px 0; text-align: right;"><strong>GH₵ ${amountGHS.toFixed(2)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Phone</td><td style="padding: 8px 0; text-align: right;">${phone || 'N/A'}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Reference</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${reference}</td></tr>
      </table>
      <p style="font-size: 12px; color: #6b6560;">Keep this email for your records. Paystack may also send its own payment confirmation.</p>
    </div>
  `;
}

function buildTicketReceiptHtml({ eventTitle, venue, date, buyerName, quantity, amountGHS, ticketCode, reference }) {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #1a1918;">
      <h1 style="font-size: 22px; font-weight: 400; margin-bottom: 8px;">Voteeq ticket receipt</h1>
      <p style="color: #6b6560; font-size: 14px; margin-top: 0;">Your ticket purchase is confirmed.</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 24px 0;">
        <tr><td style="padding: 8px 0; color: #6b6560;">Event</td><td style="padding: 8px 0; text-align: right;"><strong>${eventTitle}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Venue</td><td style="padding: 8px 0; text-align: right;">${venue || 'TBA'}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Date</td><td style="padding: 8px 0; text-align: right;">${date || 'TBA'}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Buyer</td><td style="padding: 8px 0; text-align: right;">${buyerName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Quantity</td><td style="padding: 8px 0; text-align: right;">${quantity}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Ticket code</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-weight: bold;">${ticketCode}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Amount</td><td style="padding: 8px 0; text-align: right;"><strong>GH₵ ${amountGHS.toFixed(2)}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #6b6560;">Reference</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${reference}</td></tr>
      </table>
      <p style="font-size: 12px; color: #6b6560;">Present your ticket code at the venue. You can also look up tickets on Voteeq using this reference and your email.</p>
    </div>
  `;
}

async function sendVoteReceiptEmail({ to, nomineeName, voteCount, amountGHS, reference, phone }) {
  const subject = `Voteeq vote receipt — ${nomineeName}`;
  const html = buildVoteReceiptHtml({ nomineeName, voteCount, amountGHS, reference, phone });
  const text = `Voteeq vote receipt\nNominee: ${nomineeName}\nVotes: ${voteCount}\nAmount: GH₵ ${amountGHS.toFixed(2)}\nReference: ${reference}`;
  return sendResendEmail({ to, subject, html, text });
}

async function sendTicketReceiptEmail({ to, eventTitle, venue, date, buyerName, quantity, amountGHS, ticketCode, reference }) {
  const subject = `Voteeq ticket — ${eventTitle}`;
  const html = buildTicketReceiptHtml({ eventTitle, venue, date, buyerName, quantity, amountGHS, ticketCode, reference });
  const text = `Voteeq ticket receipt\nEvent: ${eventTitle}\nTicket code: ${ticketCode}\nQuantity: ${quantity}\nAmount: GH₵ ${amountGHS.toFixed(2)}\nReference: ${reference}`;
  return sendResendEmail({ to, subject, html, text });
}

module.exports = {
  isValidEmail,
  normalizeEmail,
  sendVoteReceiptEmail,
  sendTicketReceiptEmail,
};
