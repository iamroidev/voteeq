import { BRANDING, ASCES_AWARD_CATEGORIES } from '../branding';

/** Shown on Vote and Leaderboard while no nominees are published yet */
export default function AwaitingNomineesPanel({
  onBuyTickets,
  onViewTickets,
  compact = false,
  selectedCategoryName = null,
}) {
  const categoryCount = ASCES_AWARD_CATEGORIES.length;
  const ticketsOpen = BRANDING.ticketsEnabled && onBuyTickets;

  return (
    <div className="editorial-sheet" style={{ padding: compact ? '2rem 1.5rem' : '2.5rem 2rem', marginBottom: '2rem', textAlign: 'center' }}>
      <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Coming soon</span>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: compact ? '1.25rem' : '1.5rem', marginBottom: '0.75rem' }}>
        Shortlist not published yet
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto 1.25rem' }}>
        {selectedCategoryName
          ? `Nominees for ${selectedCategoryName} will appear here once the shortlist is published.`
          : `${BRANDING.organizerName} is finalising nominees across ${categoryCount} award categories. Voting will open here once the shortlist goes live.`}
        {!selectedCategoryName && (
          BRANDING.ticketsEnabled
            ? ' Awards night tickets are available now.'
            : ' Awards night ticket sales have not opened yet.'
        )}
      </p>
      {ticketsOpen && (
        <button type="button" className="luxury-btn" onClick={onBuyTickets}>
          Buy awards night tickets
        </button>
      )}
      {!BRANDING.ticketsEnabled && onViewTickets && (
        <button type="button" className="luxury-btn secondary" onClick={onViewTickets}>
          View tickets — not on sale yet
        </button>
      )}
    </div>
  );
}
