export default function HelpSupportPage({ onBack }) {
  const faqs = [
    {
      q: 'How do I vote for a nominee?',
      a: 'Open the campus voting portal, find the nominee, and click "VOTE ONLINE". Choose how many votes you want, enter your Ghana mobile number (10 digits, starting with 02x or 05x), and complete checkout through Paystack. Each online vote costs GH₵ 1.00.',
    },
    {
      q: 'How do I buy event tickets?',
      a: 'Go to Events & Tickets, select a campus event, and fill in your name, email, and phone number. Pay through Paystack to receive your ticket reference. You can look up tickets later using your payment reference or ticket code.',
    },
    {
      q: 'What phone number format should I use?',
      a: 'Use a valid Ghana mobile number: 10 digits starting with 02x or 05x (for example 0241234567). You can also enter +233 or 233 followed by the number — it will be normalized automatically.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'Online payments are processed through Paystack, which supports MTN MoMo, Telecel Cash, AirtelTigo Money, and card payments where enabled. USSD voting at a lower rate is planned but not live yet.',
    },
    {
      q: 'Is USSD or SMS voting available?',
      a: 'Not yet. USSD and SMS receipts depend on an Arkesel shortcode, which is still being set up with stakeholders. Until that is live, use the website for voting and ticket purchases.',
    },
    {
      q: 'Is my payment secure?',
      a: 'Yes. Card and mobile money payments are handled by Paystack. Voteeq does not store your mobile money PIN or full card details on our servers.',
    },
    {
      q: 'Can I vote more than once?',
      a: 'Yes. Each vote is a separate paid transaction. There is no cap on how many times you can support the same nominee.',
    },
    {
      q: 'How do I apply as a nominee?',
      a: 'Click "Apply as Nominee", complete the form with your details and category, and pay the GH₵ 10.00 registration fee. The committee reviews your application and sends an activation PIN if approved.',
    },
    {
      q: 'How do I access my nominee dashboard?',
      a: 'After approval, use "NOMINEE LOGIN" with the code and PIN you received. The dashboard shows live vote counts and sharing tools for your campaign.',
    },
    {
      q: 'What if my payment fails or money was deducted without confirmation?',
      a: 'If checkout fails, no votes or tickets are confirmed. If money left your account but the status page did not update, contact support with your Paystack reference and the phone number used.',
    },
    {
      q: 'How do I share a nominee voting link?',
      a: 'Use "Copy link" on a nominee card. Anyone who opens that URL goes straight to that nominee\'s voting page.',
    },
    {
      q: 'Who runs payments and when do organisers get paid?',
      a: 'Paystack collects payments on behalf of the event organiser. Settlement account details are configured in the Paystack business dashboard — the signup phone number can be updated later when the stakeholder account is ready.',
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
        
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '2rem' }}>
          Find answers to common questions below. If you need further assistance, please contact our support team.
        </p>

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
          <p style={{ fontSize: '0.85rem', color: 'var(--accent-dark)', fontWeight: 500 }}>
            Need more help? Contact us at <strong>support@voteeq.com</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
