import CategoryBrowser from './CategoryBrowser';

/**
 * Compact vote-page filters: optional event picker, category browser, nominee search.
 */
export default function PublicVoteFilters({
  events = [],
  activeEventId,
  onEventChange,
  categories = [],
  selectedCategory,
  onSelectCategory,
  getCount,
  showCounts = false,
  searchQuery = '',
  onSearchChange,
  showSearch = false,
}) {
  const showEventPicker = events.length > 1;

  return (
    <div className="vote-filter-bar">
      {showEventPicker && (
        <div className="vote-filter-event">
          <span className="vote-filter-event-label">Event</span>
          <select
            value={activeEventId || ''}
            onChange={(e) => onEventChange(e.target.value)}
            className="luxury-select vote-filter-event-select"
            aria-label="Select event"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <CategoryBrowser
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        getCount={getCount}
        showCounts={showCounts}
        label="Category"
        allLabel="All nominees"
        layout="list"
      />

      {showSearch && (
        <div className="vote-filter-search">
          <div className="editorial-search-container">
            <svg
              className="editorial-search-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search nominee name or code…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="vote-filter-search-input"
              aria-label="Search nominees"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
