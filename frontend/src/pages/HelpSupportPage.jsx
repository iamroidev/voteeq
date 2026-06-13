import { BRANDING, ACSES_AWARD_CATEGORIES } from '../branding';

export default function HelpSupportPage({ onBack }) {
  const faqs = [
    {
      q: `What is ${BRANDING.eventTitle}?`,
      a: `The awards night of ${BRANDING.organizerFullName}, ${BRANDING.department}, ${BRANDING.university}, ${BRANDING.campus}. ${BRANDING.platformName} handles official ticketing and public voting.`,
    },
    {
      q: 'When can I vote?',
      a: `Voting opens on this portal once ${BRANDING.organizerName} publishes shortlisted nominees. Each online vote costs GH₵ 1.00 across ${ACSES_AWARD_CATEGORIES.length} award categories.`,
    },
    ...(BRANDING.ticketsEnabled
      ? [{
          q: 'How do I buy awards night tickets?',
          a: `Open Buy Tickets, select ${BRANDING.eventTitle}, and complete checkout with your name, email, and Ghana phone number. After payment you receive a ticket code, QR pass, and email receipt.`,
        }]
      : [{
          q: 'When can I buy awards night tickets?',
          a: `Ticket sales are not open yet. Once ${BRANDING.organizerName} announces sales, you will buy tickets here with your name, email, and Ghana phone number and receive a QR pass by email.`,
        }]),
    {
      q: 'What phone number should I use?',
      a: 'Ghana mobile: 10 digits starting with 02x or 05x (e.g. 0241234567). +233 formats are accepted.',
    },
    {
      q: 'How do I retrieve my ticket?',
      a: 'On the Tickets page, enter your ticket code (TIX-...) or payment reference plus the email used at checkout.',
    },
    {
      q: 'Is my payment secure?',
      a: `Yes. Paystack processes all payments. ${BRANDING.platformName} does not store your MoMo PIN or full card details.`,
    },
    {
      q: 'What if payment fails or money was deducted?',
      a: 'Contact support with your Paystack reference and the phone number used. No vote or ticket is confirmed until payment succeeds.',
    },
    {
      q: 'Who operates this platform?',
      a: `${BRANDING.platformName} is the independent voting and ticketing provider. ${BRANDING.organizerName} is the event host.`,
    },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Support</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Help & Support
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {faq.q}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: 'var(--accent-light)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--accent-dark)', fontWeight: 500, margin: 0 }}>
            Contact {BRANDING.platformName}: <strong>{BRANDING.supportEmail}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
