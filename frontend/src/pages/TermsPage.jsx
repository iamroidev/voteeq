export default function TermsPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Voting
      </button>
      
      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Legal</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Terms & Conditions
        </h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Last updated: June 2026</p>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>1. Acceptance of Terms</h2>
          <p style={{ marginBottom: '1rem' }}>By accessing or using the Voteeq Awards voting platform ("Platform"), you agree to be bound by these Terms & Conditions. If you do not agree, do not use the Platform.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>2. Eligibility</h2>
          <p style={{ marginBottom: '1rem' }}>The Platform is available to individuals aged 13 and above. By using the Platform, you represent that you meet this age requirement and have the legal capacity to enter into these terms.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>3. Voting Rules</h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>Each vote requires a separate payment transaction.</li>
            <li style={{ marginBottom: '0.4rem' }}>Votes are non-refundable once the payment is confirmed.</li>
            <li style={{ marginBottom: '0.4rem' }}>Vote counts are updated in real-time and are final.</li>
            <li style={{ marginBottom: '0.4rem' }}>The Platform reserves the right to disqualify fraudulent votes.</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>4. Payment Terms</h2>
          <p style={{ marginBottom: '1rem' }}>All payments are processed through Paystack. Online voting is charged at GHS 1.00 per vote. USSD voting is charged at GHS 0.50 per vote. You are responsible for any mobile money transaction fees charged by your carrier.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>5. User Accounts</h2>
          <p style={{ marginBottom: '1rem' }}>Nominee dashboard credentials (code and PIN) are confidential. You are responsible for all activity that occurs under your account. Notify us immediately of any unauthorized use.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>6. Limitation of Liability</h2>
          <p style={{ marginBottom: '1rem' }}>Voteeq Awards shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the amount you paid for votes.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>7. Modifications</h2>
          <p style={{ marginBottom: '1rem' }}>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Continued use of the Platform constitutes acceptance of the modified terms.</p>
        </div>
      </div>
    </div>
  );
}