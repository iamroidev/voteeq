const { getDB, initDB } = require('./database');
const { hashPin } = require('./security');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  console.log('Fetching all nominees from database...');
  const nominees = await db.all('SELECT id, name, code FROM nominees');
  console.log(`Found ${nominees.length} nominees.`);

  for (const nominee of nominees) {
    const pin = String(nominee.code);
    const hashed = await hashPin(pin);
    console.log(`Updating ${nominee.name} (Code: ${nominee.code}) PIN to '${pin}' using production salt...`);
    await db.run('UPDATE nominees SET passcode = ? WHERE id = ?', [hashed, nominee.id]);
  }
  console.log('✅ Activated all nominees with production salt successfully!');
}

main().catch(console.error);
