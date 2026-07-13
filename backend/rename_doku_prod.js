const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  console.log("Renaming Derrick Doku to Derrick Duku (Code: 101)...");
  await db.run("UPDATE nominees SET name = 'Derrick Duku' WHERE code = '101'");
  
  const updated = await db.get("SELECT * FROM nominees WHERE code = '101'");
  console.log("Updated Nominee Record:", updated);
}

main().catch(console.error);
