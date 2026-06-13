/** ACSES AWARDS '26 — UMaT (VoteEQ independent platform) */

export const ACSES_AWARD_CATEGORIES = [
  'Rising Star Award',
  'Most Influential Student of the Year (Male)',
  'Most Influential Student of the Year (Female)',
  'Most Dedicated Executive',
  'Course Rep of the Year',
  'Student Entrepreneur of the Year',
  'Student Politician of the Year',
  'International Student of the Year',
  'Personality of the Year',
  'Best Programmer',
  'Best UI/UX Talent',
  'Social Media Influencer',
  'Content Creator of the Year',
  'Graphic Designer of the Year',
  'Photographer of the Year',
  'Student Artist of the Year',
  'Sports Personality of the Year',
  'Freshman of the Year',
  'Leadership Excellence',
  'Innovative Student of the Year',
  'Perfect Gentleman of the Year',
  'Perfect Lady of the Year',
  'Best Cyber Security Talent',
  'Best Class of the Year',
  'Best Dancer',
  'Best Female Student in Tech',
  'Best Male Student in Tech',
  'Most Innovative Fresher',
];

export const BRANDING = {
  platformName: 'VoteEQ',
  eventTitle: "ACSES AWARDS '26",
  /** Calendar year shown on tickets/receipts (not the '26 in the event title) */
  eventYear: '2026',
  organizerName: 'ACSES',
  organizerFullName:
    'Association of Computer Science and Engineering Students (ACSES)',
  department: 'Department of Computer Science and Engineering',
  faculty: 'Faculty of Computing and Mathematical Sciences',
  university: 'University of Mines and Technology (UMaT)',
  campus: 'Tarkwa, Ghana',
  showVenue: false,
  /** Set true when shortlisted nominees are published and voting should be live */
  votingOpen: false,
  /** Set true when ACSES opens awards night ticket sales */
  ticketsEnabled: false,
  ticketEventTitle: "ACSES AWARDS '26",
  defaultTab: 'vote',
  showUssd: false,
  votePriceOnlineGhs: '1.00',
  votePriceUssdGhs: '0.50',
  /** Paystack fee gross-up (backend only — not shown as a separate line in checkout UI) */
  paystackFeePercent: 1.95,
  passPaystackFeeToCustomer: true,
  supportEmail: 'support@voteeq.online',
  privacyEmail: 'privacy@voteeq.online',
  documentTitle: "ACSES AWARDS '26 | VoteEQ",
};

/** Direct link supporters use to open the vote page for this nominee */
export function getNomineeVoteUrl(code, origin) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/?nominee=${encodeURIComponent(code)}`;
}

export function formatVotePricingLine() {
  const online = `ONLINE GH₵ ${BRANDING.votePriceOnlineGhs}`;
  if (BRANDING.showUssd) {
    return `${online} · USSD GH₵ ${BRANDING.votePriceUssdGhs} PER VOTE`;
  }
  return `${online} PER VOTE`;
}

export function formatEventMeta(event) {
  if (!event || !BRANDING.showVenue) return '';
  const venue = String(event.venue || '').trim();
  if (!venue) return '';
  return venue.toUpperCase();
}

/** Normalize stored date/year values — never show '26 where a calendar year is meant */
export function normalizeDisplayDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toUpperCase() === 'TBA') return '';
  const compact = raw.replace(/\u2019/g, "'");
  if (compact === "'26" || compact === '26') return BRANDING.eventYear;
  return raw;
}

export function formatEventDate(event) {
  return normalizeDisplayDate(event?.date) || BRANDING.eventYear;
}

export function eventMatchesTickets(event) {
  if (!event) return false;
  return event.title === BRANDING.ticketEventTitle;
}
