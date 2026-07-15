const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  const res = await db.get("SELECT name, code, votes_count FROM nominees WHERE code = '4501'");
  console.log("Nominee record:", res);
}

main().catch(console.error);
