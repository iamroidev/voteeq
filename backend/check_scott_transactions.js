const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  
  console.log("Checking nominee info for code 3405...");
  const nominee = await db.get("SELECT * FROM nominees WHERE code = '3405'");
  console.log("Nominee record:", nominee);

  if (nominee) {
    console.log("\nChecking transaction records for Scott in 'votes' table...");
    const txs = await db.all("SELECT * FROM votes WHERE nominee_id = ?", [nominee.id]);
    console.log(`Found ${txs.length} transactions:`);
    txs.forEach(t => {
      console.log(`ID: ${t.id} | Reference: ${t.payment_reference} | Vote Count: ${t.vote_count} | Status: ${t.status} | Created: ${t.created_at} | Phone: ${t.voter_phone} | Email: ${t.email}`);
    });
  } else {
    console.log("Nominee not found!");
  }
}

main().catch(console.error);
