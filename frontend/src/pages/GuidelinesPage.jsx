export default function GuidelinesPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Voting
      </button>
      
      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Guidelines</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Nominee Guidelines
        </h1>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            These guidelines outline the rules and expectations for all nominees participating in the Voteeq Awards.
          </p>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Eligibility
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must be active artists or creators in the music industry.</li>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must have released at least one published work within the eligibility period.</li>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must comply with all applicable laws and regulations.</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Dashboard Access
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Each nominee receives a unique code and PIN for dashboard access.</li>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must activate their PIN before first login.</li>
            <li style={{ marginBottom: '0.5rem' }}>Dashboard credentials are non-transferable.</li>
            <li style={{ marginBottom: '0.5rem' }}>Contact the admin immediately if credentials are compromised.</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Campaign Rules
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Nominees may promote their voting links through social media and personal channels.</li>
            <li style={{ marginBottom: '0.5rem' }}>Vote solicitation must not involve fraud, deception, or coercion.</li>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must not purchase votes using automated systems or bots.</li>
            <li style={{ marginBottom: '0.5rem' }}>Any attempt to manipulate vote counts will result in disqualification.</li>
          </ul>
          
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Code of Conduct
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Nominees must maintain professional conduct throughout the awards period.</li>
            <li style={{ marginBottom: '0.5rem' }}>Harassment, threats, or abusive behavior toward voters, other nominees, or staff is prohibited.</li>
            <li style={{ marginBottom: '0.5rem' }}>Violation of these guidelines may result in immediate disqualification.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}