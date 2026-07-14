const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  console.log("Searching database for 'Frimpong' or 'Frempong'...");
  const res = await db.all("SELECT id, code, name, category_id FROM nominees WHERE name LIKE '%Frimpong%' OR name LIKE '%Frempong%'");
  res.forEach(r => {
    console.log(`ID: ${r.id} | Code: ${r.code} | Name: ${r.name} | Category: ${r.category_id}`);
  });
}

main().catch(console.error);
