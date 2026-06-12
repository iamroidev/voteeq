/** Calendar year for ASCES Awards night — never use '26 in date fields */
const DEFAULT_EVENT_YEAR = '2026';

function normalizeDisplayDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toUpperCase() === 'TBA') return '';
  const compact = raw.replace(/\u2019/g, "'");
  if (compact === "'26" || compact === '26') return DEFAULT_EVENT_YEAR;
  return raw;
}

function formatEventDateForDisplay(value, fallback = DEFAULT_EVENT_YEAR) {
  const normalized = normalizeDisplayDate(value);
  return normalized || fallback;
}

module.exports = {
  DEFAULT_EVENT_YEAR,
  normalizeDisplayDate,
  formatEventDateForDisplay,
};
