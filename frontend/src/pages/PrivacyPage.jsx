import React from 'react';

export default function PrivacyPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Voting
      </button>
      
      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Legal</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Last updated: June 2026</p>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>1. Information We Collect</h2>
          <p style={{ marginBottom: '1rem' }}>When you use the Voteeq Awards platform, we may collect:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>Phone number (for voting transactions and receipts)</li>
            <li style={{ marginBottom: '0.4rem' }}>Email address (optional, for vote receipts)</li>
            <li style={{ marginBottom: '0.4rem' }}>Payment transaction references</li>
            <li style={{ marginBottom: '0.4rem' }}>Device and browser information</li>
            <li style={{ marginBottom: '0.4rem' }}>IP address and location data</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>2. How We Use Your Information</h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>To process and verify your votes</li>
            <li style={{ marginBottom: '0.4rem' }}>To send vote confirmation receipts via SMS/email</li>
            <li style={{ marginBottom: '0.4rem' }}>To prevent fraud and abuse</li>
            <li style={{ marginBottom: '0.4rem' }}>To improve our platform and user experience</li>
            <li style={{ marginBottom: '0.4rem' }}>To comply with legal obligations</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>3. Data Security</h2>
          <p style={{ marginBottom: '1rem' }}>We implement industry-standard security measures to protect your personal information. All payment data is encrypted and processed through Paystack, a PCI-DSS Level 1 certified payment processor. We do not store credit card numbers or bank account details on our servers.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>4. Data Sharing</h2>
          <p style={{ marginBottom: '1rem' }}>We do not sell or rent your personal information to third parties. We may share data with:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>Payment processors (Paystack) to complete transactions</li>
            <li style={{ marginBottom: '0.4rem' }}>SMS gateway providers to deliver vote receipts</li>
            <li style={{ marginBottom: '0.4rem' }}>Law enforcement when required by law</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>5. Data Retention</h2>
          <p style={{ marginBottom: '1rem' }}>We retain vote records and transaction data for as long as necessary to fulfill the purposes outlined in this policy, or as required by law. You may request deletion of your personal data by contacting us.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>6. Your Rights</h2>
          <p style={{ marginBottom: '1rem' }}>You have the right to access, correct, or delete your personal data. You may also opt out of non-essential communications. To exercise these rights, contact us at privacy@voteeq.com.</p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.75rem', marginTop: '2rem' }}>7. Contact Us</h2>
          <p>For questions about this Privacy Policy, contact us at <strong style={{ color: 'var(--accent-dark)' }}>privacy@voteeq.com</strong>.</p>
        </div>
      </div>
    </div>
  );
}