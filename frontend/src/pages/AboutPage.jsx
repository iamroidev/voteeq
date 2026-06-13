import { BRANDING, ACSES_AWARD_CATEGORIES } from '../branding';

export default function AboutPage({ onBack }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>About</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '0.5rem', lineHeight: 1.2 }}>
          {BRANDING.eventTitle}
        </h1>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-dark)', fontWeight: 600, marginBottom: '1.5rem' }}>
          {BRANDING.organizerName} · {BRANDING.campus}
        </p>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{BRANDING.eventTitle}</strong> is the annual awards night of the{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{BRANDING.organizerFullName}</strong>, hosted by the{' '}
            {BRANDING.department} at {BRANDING.university}, {BRANDING.campus}.
          </p>

          <p style={{ marginBottom: '1.5rem' }}>
            The awards celebrate academic dedication, technical excellence, leadership, and community impact across the department.
          </p>

          <p style={{ marginBottom: '1.5rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{BRANDING.platformName}</strong> is the independent platform providing{' '}
            <strong style={{ color: 'var(--text-primary)' }}>secure ticketing</strong> and{' '}
            <strong style={{ color: 'var(--text-primary)' }}>public voting</strong> for the event.
            {BRANDING.organizerName} manages nominations and the awards programme separately.
          </p>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '2rem' }}>
            How this portal works
          </h2>
          <ol style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Shortlist:</strong> {BRANDING.organizerName} publishes approved nominees across {ACSES_AWARD_CATEGORIES.length} categories.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Vote:</strong> Students vote online through {BRANDING.platformName} at GH₵ 1.00 per vote.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong style={{ color: 'var(--text-primary)' }}>Attend:</strong> {BRANDING.ticketsEnabled ? 'Purchase awards night tickets with QR check-in and email receipt.' : 'Awards night tickets will go on sale here once announced by ACSES.'}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
