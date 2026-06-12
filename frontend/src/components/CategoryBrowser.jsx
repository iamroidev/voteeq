import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Browse / filter award categories without overwhelming small screens.
 * Collapsed summary → search + scrollable list (or grid).
 */
export default function CategoryBrowser({
  categories = [],
  selectedCategory = 'all',
  onSelectCategory,
  getCount,
  showCounts = false,
  label = 'Award category',
  allLabel = 'All categories',
  layout = 'list',
  collapseOnSelect = true,
  onAfterSelect,
}) {
  const rootRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!collapseOnSelect) return;
    setExpanded(false);
    setSearch('');
  }, [selectedCategory, collapseOnSelect]);

  useEffect(() => {
    if (!expanded) return undefined;
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [expanded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  const selectedLabel = useMemo(() => {
    if (selectedCategory === 'all') {
      const total = showCounts && getCount ? getCount('all') : null;
      return total != null ? `${allLabel} (${total})` : allLabel;
    }
    const match = categories.find(
      (c) => String(c.id) === String(selectedCategory)
    );
    if (!match) return allLabel;
    const count = showCounts && getCount ? getCount(match.id) : null;
    return count != null ? `${match.name} (${count})` : match.name;
  }, [categories, selectedCategory, showCounts, getCount, allLabel]);

  const normalizeId = (id) => (id === 'all' ? 'all' : String(id));

  const handleSelect = (id) => {
    const nextId = normalizeId(id);
    onSelectCategory(nextId);
    setSearch('');
    setExpanded(false);
    onAfterSelect?.(nextId);
  };

  if (categories.length === 0) return null;

  const listClass =
    layout === 'list' ? 'category-browser-list' : 'category-browser-grid';
  const itemClass =
    layout === 'list' ? 'category-browser-row' : 'category-browser-chip';
  const nameClass =
    layout === 'list' ? 'category-browser-row-name' : 'category-browser-chip-name';
  const countClass =
    layout === 'list' ? 'category-browser-row-count' : 'category-browser-chip-count';

  const renderOption = (id, name, isActive, count, isEmpty = false) => (
    <button
      key={id}
      type="button"
      role="option"
      aria-selected={isActive}
      className={`${itemClass} ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => handleSelect(id)}
    >
      <span className={nameClass}>{name}</span>
      {showCounts && getCount && count != null && (
        <span className={countClass}>{count}</span>
      )}
      {layout === 'list' && isActive && (
        <span className="category-browser-row-check" aria-hidden="true">✓</span>
      )}
    </button>
  );

  return (
    <div className="category-browser" ref={rootRef}>
      <div className="category-browser-header">
        <span className="category-browser-label">{label}</span>
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

          <div className={listClass} role="listbox" aria-label="Award categories">
            {renderOption(
              'all',
              allLabel,
              selectedCategory === 'all',
              showCounts && getCount ? getCount('all') : null
            )}

            {filtered.map((c) => {
              const count = showCounts && getCount ? getCount(c.id) : null;
              const isActive =
                selectedCategory !== 'all' &&
                String(selectedCategory) === String(c.id);
              const isEmpty = showCounts && count === 0;
              return renderOption(c.id, c.name, isActive, count, isEmpty);
            })}

            {filtered.length === 0 && (
              <p className="category-browser-no-results">No categories match your search.</p>
            )}
          </div>

          <p className="category-browser-hint">
            {categories.length} categories · tap one to filter
          </p>
        </div>
      )}
    </div>
  );
}
