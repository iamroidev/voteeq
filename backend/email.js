const fs = require('fs');
const path = require('path');

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

async function sendResendEmail({ to, subject, html, text, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const payload = {
    from: getFromAddress(),
    to: [to],
    subject,
    html,
    text,
  };
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

function getLogoUrl() {
  const base = process.env.PUBLIC_ASSET_BASE_URL || 'https://api.voteeq.online';
  return `${base}/photos/logo.png`;
}

function buildVoteReceiptHtml({ nomineeName, voteCount, amountGHS, reference, phone }) {
  return `
    <div style="background-color: #f8fafc; padding: 16px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 500px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; overflow: hidden;">
        <!-- Logo Header -->
        <div style="padding: 24px 16px 16px 16px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <img src="${getLogoUrl()}" alt="VoteEQ" width="48" height="48" style="height: 48px; width: 48px; max-width: 48px; display: block; margin: 0 auto;" />
        </div>
        
        <!-- Body Content -->
        <div style="padding: 24px 16px 20px 16px;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #0f172a; text-align: center; letter-spacing: -0.01em;">Vote Confirmed</h2>
          <p style="font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; color: #64748b; text-align: center;">Thank you. Your vote payment was successful and has been counted.</p>
          
          <!-- Summary Table -->
          <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px 12px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Nominee</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; word-break: break-word; max-width: 180px;">${nomineeName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Votes Cast</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${voteCount}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 16px;">GH₵ ${amountGHS.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 12px 0 0 0; color: #64748b; font-weight: 500;">Voter Phone</td>
                <td style="padding: 12px 0 0 0; text-align: right; color: #0f172a; font-family: monospace; font-size: 13px; word-break: break-all;">${phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Reference</td>
                <td style="padding: 8px 0; text-align: right; color: #64748b; font-family: monospace; font-size: 12px; word-break: break-all;">${reference}</td>
              </tr>
            </table>
          </div>
          
          <!-- Footer -->
          <p style="font-size: 11px; line-height: 1.5; color: #94a3b8; text-align: center; margin: 0;">
            This email is an official receipt from VoteEQ. For inquiries, reach out to <a href="mailto:support@voteeq.online" style="color: #0f172a; text-decoration: underline;">support@voteeq.online</a>.
          </p>
        </div>
      </div>
    </div>
  `;
}

function ticketQrImageUrl(ticketCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticketCode)}&margin=8`;
}

function buildTicketReceiptHtml({ eventTitle, venue, date, buyerName, quantity, amountGHS, ticketCode, reference }) {
  const venueRow = venue
    ? `<tr><td style="padding: 8px 0; color: #64748b; font-weight: 500;">Venue</td><td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; word-break: break-word; max-width: 180px;">${venue}</td></tr>`
    : '';
  const dateRow = date
    ? `<tr><td style="padding: 8px 0; color: #64748b; font-weight: 500;">Date</td><td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; word-break: break-word; max-width: 180px;">${date}</td></tr>`
    : '';

  return `
    <div style="background-color: #f8fafc; padding: 16px 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 500px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; overflow: hidden;">
        <!-- Logo Header -->
        <div style="padding: 24px 16px 16px 16px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <img src="${getLogoUrl()}" alt="VoteEQ" width="48" height="48" style="height: 48px; width: 48px; max-width: 48px; display: block; margin: 0 auto;" />
        </div>
        
        <!-- Body Content -->
        <div style="padding: 24px 16px 20px 16px;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #0f172a; text-align: center; letter-spacing: -0.01em;">Ticket Confirmed</h2>
          <p style="font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; color: #64748b; text-align: center;">Present this ticket code or QR code at the door for entry.</p>
          
          <!-- Ticket Code Frame -->
          <div style="border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px 12px; margin-bottom: 20px; background: #fafafa;">
            <img src="${ticketQrImageUrl(ticketCode)}" width="180" height="180" alt="Ticket QR Code" style="border: 1px solid #e2e8f0; border-radius: 8px; display: block; margin: 0 auto 16px auto;" />
            <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 4px; font-weight: 600;">Ticket Code</span>
            <span style="font-family: monospace; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: 0.05em; display: block;">${ticketCode}</span>
          </div>

          <!-- Summary Table -->
          <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px 12px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Event</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; word-break: break-word; max-width: 180px;">${eventTitle}</td>
              </tr>
              ${venueRow}
              ${dateRow}
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Buyer</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600; word-break: break-word; max-width: 180px;">${buyerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Quantity</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 600;">${quantity} guest(s)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Amount Paid</td>
                <td style="padding: 8px 0; text-align: right; color: #0f172a; font-weight: 700; font-size: 16px;">GH₵ ${amountGHS.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px dashed #cbd5e1;">
                <td style="padding: 12px 0 0 0; color: #64748b; font-weight: 500;">Reference</td>
                <td style="padding: 12px 0 0 0; text-align: right; color: #64748b; font-family: monospace; font-size: 12px; word-break: break-all;">${reference}</td>
              </tr>
            </table>
          </div>
          
          <!-- Footer -->
          <p style="font-size: 11px; line-height: 1.5; color: #94a3b8; text-align: center; margin: 0;">
            This email is an official ticket from VoteEQ. For inquiries, reach out to <a href="mailto:support@voteeq.online" style="color: #0f172a; text-decoration: underline;">support@voteeq.online</a>.
          </p>
        </div>
      </div>
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
  const subject = `VoteEQ ticket — ${eventTitle}`;
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
