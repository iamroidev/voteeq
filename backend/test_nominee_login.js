const { getDB, initDB } = require('./database');
const { verifyPin } = require('./security');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  const nominee = await db.get("SELECT * FROM nominees WHERE code = '301'");
  if (!nominee) {
    console.log("❌ Nominee 301 not found!");
    return;
  }
  console.log("Nominee 301 record in production DB:", {
    name: nominee.name,
    code: nominee.code,
    passcode: nominee.passcode
  });
  const verify = await verifyPin('301', nominee.passcode);
  console.log("Verify PIN '301' Result:", verify);
}

main().catch(console.error);
