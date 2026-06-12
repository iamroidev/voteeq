import { BRANDING } from '../branding';

export default function GuidelinesPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Guidelines</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2 }}>
          Nominee & Voting Guidelines
        </h1>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            Guidelines for <strong style={{ color: 'var(--text-primary)' }}>{BRANDING.eventTitle}</strong>,
            organised by {BRANDING.organizerName}, {BRANDING.university}.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Published nominees
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Only nominees approved and published by {BRANDING.organizerName} appear on this portal.</li>
            <li style={{ marginBottom: '0.5rem' }}>Each shortlisted nominee receives a unique code and PIN for the nominee dashboard.</li>
            <li style={{ marginBottom: '0.5rem' }}>Credentials are non-transferable. Report compromised access to the committee immediately.</li>
          </ul>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Public voting
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Voting is conducted on {BRANDING.platformName} once the shortlist is live.</li>
            <li style={{ marginBottom: '0.5rem' }}>Each vote is a separate paid transaction (GH₵ 1.00 online).</li>
            <li style={{ marginBottom: '0.5rem' }}>Vote solicitation must not involve fraud, bots, or coercion.</li>
            <li style={{ marginBottom: '0.5rem' }}>The committee may disqualify any nominee who breaches these rules.</li>
          </ul>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            Campaign conduct
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Nominees may share voting links through legitimate personal channels.</li>
            <li style={{ marginBottom: '0.5rem' }}>Maintain professional conduct throughout the awards period.</li>
            <li style={{ marginBottom: '0.5rem' }}>Harassment or abusive behaviour toward voters or other nominees is prohibited.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
