import { useMemo, useState } from 'react';

/**
 * Browse / filter award categories without overwhelming small screens.
 * Progressive disclosure: compact summary → search + scrollable grid.
 */
export default function CategoryBrowser({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  getCount,
  showCounts = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const selectedLabel = useMemo(() => {
    if (selectedCategory === 'all') {
      const total = showCounts && getCount ? getCount('all') : null;
      return total != null ? `All categories (${total})` : 'All categories';
    }
    const match = categories.find(
      (c) => String(c.id) === String(selectedCategory)
    );
    if (!match) return 'All categories';
    const count = showCounts && getCount ? getCount(match.id) : null;
    return count != null ? `${match.name} (${count})` : match.name;
  }, [categories, selectedCategory, showCounts, getCount]);

  const handleSelect = (id) => {
    onSelectCategory(id);
    setSearch('');
  };

  if (categories.length === 0) return null;

  return (
    <div className="category-browser">
      <div className="category-browser-header">
        <span className="category-browser-label">Award category</span>
        <button
          type="button"
          className="category-browser-summary"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="category-browser-summary-text">{selectedLabel}</span>
          <span className="category-browser-chevron" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="category-browser-panel">
          <div className="category-browser-search-wrap">
            <svg
              className="category-browser-search-icon"
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
              className="category-browser-search"
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search award categories"
            />
            {search && (
              <button
                type="button"
                className="category-browser-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="category-browser-grid" role="listbox" aria-label="Award categories">
            <button
              type="button"
              role="option"
              aria-selected={selectedCategory === 'all'}
              className={`category-browser-chip ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleSelect('all')}
            >
              <span className="category-browser-chip-name">All categories</span>
              {showCounts && getCount && (
                <span className="category-browser-chip-count">{getCount('all')}</span>
              )}
            </button>

            {filtered.map((c) => {
              const count = showCounts && getCount ? getCount(c.id) : null;
              const isActive =
                selectedCategory === 'all'
                  ? false
                  : String(selectedCategory) === String(c.id);
              const isEmpty = showCounts && count === 0;

              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`category-browser-chip ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
                  onClick={() => handleSelect(c.id)}
                >
                  <span className="category-browser-chip-name">{c.name}</span>
                  {showCounts && getCount && (
                    <span className="category-browser-chip-count">{count}</span>
                  )}
                </button>
              );
            })}

            {filtered.length === 0 && (
              <p className="category-browser-no-results">No categories match your search.</p>
            )}
          </div>

          <p className="category-browser-hint">
            {categories.length} award categories · tap to filter
          </p>
        </div>
      )}
    </div>
  );
}
