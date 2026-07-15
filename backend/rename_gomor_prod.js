const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  
  console.log("Renaming Gomor Princess Nana-Dokuwaah to Gamor Princess Nana-Dokuwaah...");
  await db.run("UPDATE nominees SET name = 'Gamor Princess Nana-Dokuwaah' WHERE code = '1701'");
  
  const updated = await db.get("SELECT name, code FROM nominees WHERE code = '1701'");
  console.log("Updated Nominee Record:", updated);
}

main().catch(console.error);
