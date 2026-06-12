export default function HelpSupportPage({ onBack }) {
  const faqs = [
    { q: 'How do I vote for my favorite nominee?', a: 'Click the "VOTE ONLINE" button on any nominee card, choose your vote count, enter your mobile money number, and complete the payment. You can also dial *920*566# from your phone.' },
    { q: 'What payment methods are accepted?', a: 'We accept Mobile Money payments through MTN MoMo, Telecel Cash, and AirtelTigo Money. Online voting costs GH₵ 1.00 per vote, USSD voting costs GH₵ 0.50 per vote.' },
    { q: 'Is my payment secure?', a: 'Yes. All payments are processed securely through local Mobile Money channels using standard transaction encryption. Your financial data is protected and never stored on our servers.' },
    { q: 'Can I vote multiple times?', a: 'Yes! There is no limit to how many times you can vote for your favorite nominee. Each transaction is processed separately.' },
    { q: 'How do I become a nominee?', a: 'Nominees are selected by the Voteeq Awards committee. If you are a nominee, you will receive a code and PIN to access your dashboard. Contact admin for more information.' },
    { q: 'How do I access my nominee dashboard?', a: 'Click "NOMINEE LOGIN" in the top navigation bar, enter your nominee code and PIN. Your dashboard shows real-time vote statistics and sharing tools.' },
    { q: 'What happens if my payment fails?', a: 'If a payment fails, no votes are recorded. You can retry the voting process. If money was deducted but votes weren\'t added, contact support with your payment reference.' },
    { q: 'How do I share a nominee\'s voting link?', a: 'Click "Copy link" on any nominee card to get a shareable URL. When someone opens this link, they\'ll be taken directly to that nominee\'s voting page.' },
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