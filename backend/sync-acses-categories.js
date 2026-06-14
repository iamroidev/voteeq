/**
 * One-off sync: replace ACSES award categories in Turso with seed-acses-categories.js list.
 * Preserves nominees by remapping category_id where names changed.
 */
require('dotenv').config();
const { createClient } = require('@libsql/client');
const { ACSES_AWARD_CATEGORIES } = require('./seed-acses-categories');

const CATEGORY_RENAMES = {
  'Most Dedicated Executive': 'Most Dedicated Executive of the Year',
  'Course Rep of the Year': 'Course Representative of the Year',
  'Best Programmer': 'Best Programmer of the Year',
  'Best UI/UX Talent': 'Best UI/UX Talent of the Year',
  'Leadership Excellence': 'Leadership Excellence Award',
  'Innovative Student of the Year': 'Most Innovative Student of the Year',
  'Perfect Gentleman of the Year': 'Gentleman of the Year',
  'Perfect Lady of the Year': 'Lady of the Year',
  'Best Cyber Security Talent': 'Best Cybersecurity Talent of the Year',
  'Best Dancer': 'Best Dancer of the Year',
  'Most Innovative Fresher': 'Most Innovative Freshman of the Year',
  'Student Entrepreneur of the Year': 'Male Entrepreneur of the Year',
};

(async () => {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const newNames = new Set(ACSES_AWARD_CATEGORIES.map(([name]) => name));
  const existing = await client.execute('SELECT id, name, description FROM categories');
  const byName = new Map(existing.rows.map((r) => [r.name, r]));

  for (const [oldName, newName] of Object.entries(CATEGORY_RENAMES)) {
    const row = byName.get(oldName);
    if (row && !byName.has(newName)) {
      const desc = ACSES_AWARD_CATEGORIES.find(([n]) => n === newName)?.[1] || row.description;
      await client.execute({
        sql: 'UPDATE categories SET name = ?, description = ? WHERE id = ?',
        args: [newName, desc, row.id],
      });
      byName.delete(oldName);
      byName.set(newName, { ...row, name: newName, description: desc });
      console.log(`Renamed: ${oldName} → ${newName}`);
    }
  }

  for (const [name, description] of ACSES_AWARD_CATEGORIES) {
    if (!byName.has(name)) {
      const result = await client.execute({
        sql: 'INSERT INTO categories (name, description) VALUES (?, ?)',
        args: [name, description],
      });
      console.log(`Inserted: ${name} (id ${result.lastInsertRowid})`);
      byName.set(name, { id: Number(result.lastInsertRowid), name, description });
    } else {
      await client.execute({
        sql: 'UPDATE categories SET description = ? WHERE name = ?',
        args: [description, name],
      });
    }
  }

  const refreshed = await client.execute('SELECT id, name FROM categories');
  const inUse = await client.execute('SELECT DISTINCT category_id FROM nominees');

  const usedIds = new Set(inUse.rows.map((r) => r.category_id));
  for (const row of refreshed.rows) {
    if (!newNames.has(row.name) && !usedIds.has(row.id)) {
      await client.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [row.id] });
      console.log(`Removed obsolete: ${row.name}`);
    } else if (!newNames.has(row.name) && usedIds.has(row.id)) {
      console.warn(`Kept legacy category (nominee linked): ${row.name}`);
    }
  }

  const nominees = await client.execute(`
    SELECT n.id, n.code, n.name, c.name AS category_name
    FROM nominees n JOIN categories c ON n.category_id = c.id
  `);
  const final = await client.execute('SELECT COUNT(*) AS count FROM categories');
  console.log('Nominees:', JSON.stringify(nominees.rows));
  console.log(`Done. ${final.rows[0].count} categories in database.`);
})();
