export default function AboutPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>
      
      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>About</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          About the Voteeq Awards
        </h1>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            The <strong style={{ color: 'var(--text-primary)' }}>Voteeq Awards</strong> is a premier recognition platform dedicated to honoring excellence and creative achievements in the contemporary musical arts. We celebrate the artists, producers, and visionaries who shape the sound of our generation.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Our Mission
          </h2>
          <p style={{ marginBottom: '1.5rem' }}>
            To create a transparent, accessible, and engaging voting platform that empowers fans to recognize and support their favorite artists. Every vote counts, and every voice matters.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            How It Works
          </h2>
          <p style={{ marginBottom: '1rem' }}>
            Voting is simple and secure. You can cast your votes through two channels:
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Online Voting:</strong> Use our web portal to vote via mobile money (MTN, Telecel, AirtelTigo). Rate: GH₵ 1.00 per vote.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>USSD Shortcode:</strong> Dial *920*566# on your mobile phone to vote via USSD. Rate: GH₵ 0.50 per vote.</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Our Values
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Transparency:</strong> All votes are verified and counted in real-time.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Security:</strong> Your payments are protected through secure mobile money channels.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Fairness:</strong> Every nominee has an equal opportunity to be recognized.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Accessibility:</strong> Multiple voting channels ensure everyone can participate.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}