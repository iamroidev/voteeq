const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  
  console.log("Updating Scott (Code: 3405) votes_count to 40...");
  await db.run("UPDATE nominees SET votes_count = 40 WHERE code = '3405'");
  
  const updated = await db.get("SELECT name, code, votes_count FROM nominees WHERE code = '3405'");
  console.log("Updated Nominee Record:", updated);
}

main().catch(console.error);
