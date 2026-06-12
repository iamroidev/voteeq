export default function PaymentPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>
      
      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Security</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Payment Protection
        </h1>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            Your payment security is our top priority. Here's how we protect every transaction on the Voteeq Awards platform.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Secure Payment Processing
          </h2>
          <p style={{ marginBottom: '1.5rem' }}>
            All payments are processed securely through local Mobile Money networks. This ensures your financial data is always encrypted and protected.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Mobile Money Security
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            When voting via mobile money, the transaction is handled directly by your mobile carrier (MTN, Telecel, or AirtelTigo). Your mobile money PIN is never shared with or stored by Voteeq. We only receive a confirmation that the payment was successful.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Transaction Receipts
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            Every successful vote generates a unique transaction receipt. You can verify your payment using the reference code provided in your receipt. All receipts are logged and can be retrieved for audit purposes.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Refund Policy
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            Once a vote payment is confirmed, it is <strong style={{ color: 'var(--text-primary)' }}>non-refundable</strong>. However, if your payment was deducted but your votes were not recorded, please contact our support team with your payment reference code, and we will investigate and resolve the issue.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Fraud Prevention
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            We employ rate limiting, HMAC-signed tokens, and real-time transaction monitoring to prevent fraud and abuse. Suspicious activity is automatically flagged and reviewed by our security team.
          </p>
          
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--accent-light)', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--accent-dark)', fontWeight: 500 }}>
              Payment processing powered securely by local Mobile Money providers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}