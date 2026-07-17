/** ACSES AWARDS '26 — UMaT (VoteEQ independent platform) */

export const ACSES_AWARD_CATEGORIES = [
  'Most Influential Student of the Year (Male)',
  'Most Influential Student of the Year (Female)',
  'Most Dedicated Executive',
  'Course Rep of the Year',
  'Student Politician of the Year',
  'International Student of the Year',
  'Best Programmer',
  'Best UI/UX Talent',
  'Social Media Influencer',
  'Content Creator of the Year',
  'Graphic Designer of the Year',
  'Photographer of the Year',
  'Sports Personality of the Year',
  'Freshman of the Year',
  'Leadership Excellence',
  'Innovative Student of the Year',
  'Perfect Gentleman of the Year',
  'Perfect Lady of the Year',
  'Best Cyber Security Talent',
  'Best Robotics Talent',
  'Best IS Talent',
  'Best Class of the Year',
  'Best Dancer',
  'Best Female Student in Tech',
  'Best Male Student in Tech',
  'Most Innovative Fresher',
  'Female Entrepreneur of the Year',
  'Male Entrepreneur of the Year',
  'Best Student Personality of the Year',
  'Male Most Popular Student of the Year (Freshman)',
  'Female Most Popular Student of the Year (Freshman)',
  'Best Sportsman of the Year (Freshman)',
  'Best Sportswoman of the Year (Freshman)',
  'Male Most Fashionable of the Year',
  'Female Most Fashionable of the Year',
  'Female Student Model of the Year',
  'Male Student Model of the Year',
  'Male Best Photogenic Student of the Year',
  'Female Best Photogenic Student of the Year',
  'Face of ACSES (Female)',
  'Face of ACSES (Male)',
  'Artiste of the Year',
  'Male Most Popular Student of the Year',
  'Female Most Popular Student of the Year',
  'Sportswoman of the Year',
];

export const BRANDING = {
  platformName: 'VoteEQ',
  eventTitle: '"Praemia Pro Virtute" Dinner & Awards Night',
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
  votingOpen: true,
  /** Set true to lock the public leaderboard and stand until official announcement */
  leaderboardLocked: true,
  /** Set true when ACSES opens awards night ticket sales */
  ticketsEnabled: false,
  ticketEventTitle: '"Praemia Pro Virtute" Dinner & Awards Night',
  defaultTab: 'vote',
  showUssd: false,
  ussdShortcode: '*SHORTCODE#',
  votePriceOnlineGhs: '1.00',
  votePriceUssdGhs: '0.50',
  /** Paystack fee gross-up (backend only — not shown as a separate line in checkout UI) */
  paystackFeePercent: 1.95,
  passPaystackFeeToCustomer: true,
  supportEmail: 'support@voteeq.online',
  privacyEmail: 'privacy@voteeq.online',
  documentTitle: '"Praemia Pro Virtute" Dinner & Awards Night | VoteEQ',
};

export function getNomineeUssdCode(code) {
  const base = (BRANDING.ussdShortcode || '*SHORTCODE#').replace(/#/g, '');
  return `${base}*${code}#`;
}

/** Direct link supporters use to open the vote page for this nominee */
export function fixAscesSpelling(text) {
  if (text == null || text === '') return text;
  return String(text).replace(/ASCES/g, 'ACSES');
}

export function displayEventTitle(event) {
  return fixAscesSpelling(event?.title) || BRANDING.eventTitle;
}

export function getNomineeVoteUrl(code, origin) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/?nominee=${encodeURIComponent(code)}`;
}

/** Link to share on WhatsApp/social — serves OG preview then redirects to the vote page */
export function getNomineeShareUrl(code, apiBase) {
  const base = (apiBase || '').replace(/\/$/, '');
  if (!base) {
    return getNomineeVoteUrl(code);
  }
  return `${base}/share/${encodeURIComponent(code)}`;
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
  return fixAscesSpelling(event.title) === BRANDING.ticketEventTitle;
}
