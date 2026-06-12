import { BRANDING } from '../branding';

export default function NotFoundPage() {
  return (
    <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem 1.5rem', textAlign: 'center' }}>
      <div className="editorial-sheet" style={{ padding: '4rem 3rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>404 Error</span>
        
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', lineHeight: 1.2, color: 'var(--text-primary)' }}>
          Page Not Found
        </h1>
        
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.8 }}>
          The link you followed may be broken, or the page may have been moved. Let's get you back on track.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          <button 
            onClick={() => { window.location.hash = '#/vote'; }} 
            className="luxury-btn" 
            style={{ padding: '0.8rem 1.5rem', letterSpacing: '0.1em' }}
          >
            RETURN TO VOTE PORTAL
          </button>
          
          <button 
            onClick={() => { window.location.hash = '#/leaderboard'; }} 
            className="luxury-btn secondary" 
            style={{ padding: '0.8rem 1.5rem', letterSpacing: '0.1em' }}
          >
            VIEW LIVE STANDINGS
          </button>

          <button 
            onClick={() => { window.location.hash = '#/tickets'; }} 
            className="luxury-btn secondary" 
            style={{ padding: '0.8rem 1.5rem', letterSpacing: '0.1em' }}
          >
            {BRANDING.ticketsEnabled ? 'BUY EVENT TICKETS' : 'AWARDS NIGHT TICKETS (NOT OPEN)'}
          </button>
        </div>
      </div>
    </div>
  );
}
