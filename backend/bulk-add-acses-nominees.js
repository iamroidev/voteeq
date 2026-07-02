/**
 * Bulk-add ACSES shortlist nominees with category-prefixed codes.
 * Usage: node bulk-add-acses-nominees.js
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in env (or backend/.env).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@libsql/client');
const { ACSES_AWARD_CATEGORIES } = require('./seed-acses-categories');

const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';

const EVENT_ID = 19;

const SHORTLIST = [
  { name: 'Vorsah Kenneth Kweku', category: 'Male Entrepreneur of the Year' },
  { name: 'Safo Emmanuel Gyamfi', category: 'Best Programmer' },
  { name: 'Daniels Papa Ayebi', category: 'Sports Personality of the Year' },
  { name: 'Michael Nkansah Frempong', category: 'Best UI/UX Talent' },
  { name: 'Kelvin Awere', category: 'Best Sportsman of the Year (Freshman)' },
  { name: 'Kelvin Kweku Fosu', category: 'Male Most Fashionable of the Year' },
  { name: 'Araba Fenyiwah Turkson', category: 'Leadership Excellence' },
  { name: 'Beatrice Appiah Annan', category: 'Most Dedicated Executive' },
  { name: 'Richelle Abakah Asmah', category: 'Best Female Student in Tech' },
  { name: 'Miriam Adjeley Sowah', category: 'Female Entrepreneur of the Year' },
  { name: 'Nana Kwabena Addo Nyarko', category: 'Innovative Student of the Year' },
  { name: 'Frederick Alaazy', category: 'Sports Personality of the Year' },
];

function categoryPrefix(categoryName, categoryId) {
  const listIndex = ACSES_AWARD_CATEGORIES.findIndex(
    (cat) => (Array.isArray(cat) ? cat[0] : cat) === categoryName
  );
  return listIndex !== -1 ? listIndex + 1 : categoryId;
}

async function nextCode(client, prefix, takenCodes) {
  let seq = 1;
  while (seq < 100) {
    const candidate = `${prefix}${String(seq).padStart(2, '0')}`;
    if (!takenCodes.has(candidate)) {
      const row = await client.execute({
        sql: 'SELECT id FROM nominees WHERE code = ?',
        args: [candidate],
      });
      if (row.rows.length === 0) {
        takenCodes.add(candidate);
        return candidate;
      }
    }
    seq += 1;
  }
  throw new Error(`No available code for prefix ${prefix}`);
}

function tempPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

(async () => {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required');
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const categories = await client.execute('SELECT id, name FROM categories');
  const byName = new Map(categories.rows.map((r) => [r.name, r.id]));

  const existingCodes = await client.execute('SELECT code FROM nominees');
  const takenCodes = new Set(existingCodes.rows.map((r) => r.code));

  const results = [];

  for (const entry of SHORTLIST) {
    const categoryId = byName.get(entry.category);
    if (!categoryId) {
      console.error(`Category not found: ${entry.category}`);
      continue;
    }

    const duplicate = await client.execute({
      sql: 'SELECT id, code FROM nominees WHERE name = ? AND category_id = ?',
      args: [entry.name, categoryId],
    });
    if (duplicate.rows.length > 0) {
      const row = duplicate.rows[0];
      console.log(`Skip (exists): ${entry.name} → ${row.code}`);
      results.push({ name: entry.name, code: row.code, category: entry.category, status: 'exists' });
      continue;
    }

    const prefix = categoryPrefix(entry.category, categoryId);
    const code = await nextCode(client, prefix, takenCodes);
    const pin = tempPin();

    await client.execute({
      sql: `INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)`,
      args: [code, entry.name, DEFAULT_PHOTO, categoryId, EVENT_ID, `PENDING_ACT_${pin}`],
    });

    console.log(`Added: ${entry.name} | ${entry.category} | code ${code} | PIN ${pin}`);
    results.push({ name: entry.name, code, category: entry.category, pin, status: 'added' });
  }

  console.log('\n--- Summary ---');
  for (const r of results) {
    console.log(
      `${r.status === 'added' ? '+' : '='} ${r.code} ${r.name} (${r.category})${r.pin ? ` PIN:${r.pin}` : ''}`
    );
  }
  console.log(`Total: ${results.filter((r) => r.status === 'added').length} added, ${results.filter((r) => r.status === 'exists').length} skipped`);
})();
