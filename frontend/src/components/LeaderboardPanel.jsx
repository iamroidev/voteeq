import { useMemo, useState } from 'react';

const PODIUM_SIZE = 3;
const COLLAPSED_PREVIEW = 3;
const DEFAULT_VISIBLE = 8;

function sortByVotes(nominees) {
  return [...nominees].sort((a, b) => b.votes_count - a.votes_count);
}

function RankBadge({ rank }) {
  const isGold = rank === 1;
  const isSilver = rank === 2;
  const bg = isGold ? 'var(--accent)' : isSilver ? 'var(--text-primary)' : 'transparent';
  const color = isGold || isSilver ? '#fff' : 'var(--text-secondary)';
  const border = isGold || isSilver ? 'none' : '1px solid var(--border-color)';

  return (
    <span
      className="lb-rank"
      style={{ background: bg, color, border }}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

function NomineeRow({ nom, rank, totalVotes, compact = false }) {
  const percentage = totalVotes > 0 ? Math.round((nom.votes_count / totalVotes) * 100) : 0;
  const isLeader = rank === 1;

  return (
    <div className={`lb-row${compact ? ' lb-row--compact' : ''}`}>
      <RankBadge rank={rank} />
      <img
        src={nom.photo_url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`lb-avatar${isLeader ? ' lb-avatar--leader' : ''}`}
      />
      <div className="lb-row-body">
        <div className="lb-row-meta">
          <span className="lb-name">
            {nom.name}
            {!compact && (
              <span className="lb-code"> {nom.code}</span>
            )}
          </span>
          <span className="lb-votes">
            {nom.votes_count.toLocaleString()}
            <span className="lb-pct"> ({percentage}%)</span>
          </span>
        </div>
        <div className="lb-track" aria-hidden="true">
          <div
            className={`lb-fill${isLeader ? ' lb-fill--leader' : ''}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PodiumStrip({ nominees, totalVotes }) {
  const top = nominees.slice(0, PODIUM_SIZE);
  if (top.length === 0) return null;

  return (
    <div className="lb-podium" role="list" aria-label="Top three">
      {top.map((nom, idx) => {
        const rank = idx + 1;
        const pct = totalVotes > 0 ? Math.round((nom.votes_count / totalVotes) * 100) : 0;
        return (
          <div key={nom.id} className={`lb-podium-slot lb-podium-slot--${rank}`} role="listitem">
            <span className="lb-podium-rank">{rank}</span>
            <img src={nom.photo_url} alt="" loading="lazy" decoding="async" className="lb-podium-photo" />
            <span className="lb-podium-name">{nom.name}</span>
            <span className="lb-podium-votes">{nom.votes_count.toLocaleString()} · {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function CategoryLeaderboard({ category, nominees, expanded, onToggle }) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => sortByVotes(nominees), [nominees]);
  const totalVotes = sorted.reduce((sum, n) => sum + n.votes_count, 0);
  const preview = sorted.slice(0, COLLAPSED_PREVIEW);
  const visibleRest = showAll ? sorted.slice(PODIUM_SIZE) : sorted.slice(PODIUM_SIZE, PODIUM_SIZE + DEFAULT_VISIBLE);
  const hiddenCount = Math.max(0, sorted.length - PODIUM_SIZE - visibleRest.length);

  if (sorted.length === 0) {
    return (
      <p className="lb-empty">No nominees in this category yet.</p>
    );
  }

  return (
    <section className="lb-category">
      <button
        type="button"
        className="lb-category-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="lb-category-toggle-text">
          <h2 className="lb-category-title">{category.name}</h2>
          <p className="lb-category-sub">
            {sorted.length} nominee{sorted.length !== 1 ? 's' : ''} · {totalVotes.toLocaleString()} votes
          </p>
        </div>
        {!expanded && preview.length > 0 && (
          <div className="lb-category-preview" aria-hidden="true">
            {preview.map((nom, idx) => (
              <span key={nom.id} className="lb-preview-chip">
                <span className="lb-preview-rank">{idx + 1}</span>
                {nom.name.split(' ')[0]}
                <span className="lb-preview-votes">{nom.votes_count}</span>
              </span>
            ))}
          </div>
        )}
        <span className="lb-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="lb-category-body">
          <PodiumStrip nominees={sorted} totalVotes={totalVotes} />
          <div className="lb-list">
            {visibleRest.map((nom, idx) => (
              <NomineeRow
                key={nom.id}
                nom={nom}
                rank={idx + PODIUM_SIZE + 1}
                totalVotes={totalVotes}
                compact
              />
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="lb-show-more luxury-btn secondary"
              onClick={() => setShowAll(true)}
            >
              Show {hiddenCount} more nominee{hiddenCount !== 1 ? 's' : ''}
            </button>
          )}
          {showAll && sorted.length > PODIUM_SIZE + DEFAULT_VISIBLE && (
            <button
              type="button"
              className="lb-show-more luxury-btn secondary"
              onClick={() => setShowAll(false)}
            >
              Show less
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SingleCategoryLeaderboard({ category, nominees }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => sortByVotes(nominees), [nominees]);
  const totalVotes = sorted.reduce((sum, n) => sum + n.votes_count, 0);

  const rest = sorted.slice(PODIUM_SIZE);
  const visibleRest = showAll ? rest : rest.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = rest.length - visibleRest.length;

  if (sorted.length === 0) {
    return (
      <div className="editorial-sheet lb-single-sheet">
        <p className="lb-empty">No nominees in {category?.name || 'this category'} yet.</p>
      </div>
    );
  }

  return (
    <div className="editorial-sheet lb-single-sheet">
      <header className="lb-single-header">
        <h2 className="lb-category-title">{category.name}</h2>
        <p className="lb-category-sub">
          {sorted.length} nominee{sorted.length !== 1 ? 's' : ''} · {totalVotes.toLocaleString()} total votes
        </p>
      </header>

      <PodiumStrip nominees={sorted} totalVotes={totalVotes} />

      {rest.length > 0 && (
        <div className="lb-list lb-list--single">
          {visibleRest.map((nom, idx) => (
            <NomineeRow
              key={nom.id}
              nom={nom}
              rank={idx + PODIUM_SIZE + 1}
              totalVotes={totalVotes}
            />
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          className="lb-show-more luxury-btn secondary"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more nominee{hiddenCount !== 1 ? 's' : ''}
        </button>
      )}
      {showAll && rest.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          className="lb-show-more luxury-btn secondary"
          onClick={() => setShowAll(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
}

/**
 * Compact leaderboard: accordion per category when browsing all,
 * focused podium + paginated list for one category.
 */
export default function LeaderboardPanel({ categories = [], nominees = [], selectedCategory = 'all' }) {
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  const categoriesToShow = useMemo(() => {
    if (selectedCategory !== 'all') {
      const cat = categories.find((c) => String(c.id) === String(selectedCategory));
      return cat ? [cat] : [];
    }
    return categories;
  }, [categories, selectedCategory]);

  if (selectedCategory !== 'all') {
    const category = categoriesToShow[0];
    const catNominees = nominees.filter(
      (n) => String(n.category_id) === String(selectedCategory)
    );
    return (
      <SingleCategoryLeaderboard category={category} nominees={catNominees} />
    );
  }

  const firstId = categoriesToShow[0]?.id;
  const activeId = expandedCategoryId ?? firstId ?? null;

  return (
    <div className="lb-accordion">
      {categoriesToShow.map((cat) => {
        const catNominees = nominees.filter(
          (n) => String(n.category_id) === String(cat.id)
        );
        const isExpanded = String(cat.id) === String(activeId);
        return (
          <CategoryLeaderboard
            key={cat.id}
            category={cat}
            nominees={catNominees}
            expanded={isExpanded}
            onToggle={() => {
              setExpandedCategoryId(isExpanded ? null : cat.id);
            }}
          />
        );
      })}
    </div>
  );
}
