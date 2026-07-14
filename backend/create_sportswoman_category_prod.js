const { getDB, initDB } = require('./database');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  await initDB();
  const db = getDB();
  
  console.log("1. Creating Sportswoman of the Year category in database...");
  await db.run(
    "INSERT OR IGNORE INTO categories (id, name, description) VALUES (?, ?, ?)",
    [146, "Sportswoman of the Year", "Outstanding female athlete of the year (General)"]
  );
  console.log("Category created successfully!");

  console.log("\n2. Removing incorrect nominee codes 4502 and 1306...");
  await db.run("DELETE FROM nominees WHERE code IN ('4502', '1306')");
  console.log("Nominees deleted successfully!");

  console.log("\n3. Inserting correct nominee records...");
  const tempPasscode4601 = "PENDING_ACT_4601";
  const tempPasscode4701 = "PENDING_ACT_4701";

  await db.run(
    "INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode) VALUES (?, ?, ?, ?, ?, ?)",
    ["4601", "Serwaah Nhyirah Johnson", "https://api.voteeq.online/photos/4601.jpg", 145, 19, tempPasscode4601]
  );
  console.log("Added Serwaah Nhyirah Johnson (Code: 4601) - Female Most Popular");

  await db.run(
    "INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode) VALUES (?, ?, ?, ?, ?, ?)",
    ["4701", "Serwaah Nhyirah Johnson", "https://api.voteeq.online/photos/4701.jpg", 146, 19, tempPasscode4701]
  );
  console.log("Added Serwaah Nhyirah Johnson (Code: 4701) - Sportswoman of the Year");

  console.log("\n✅ Database migrations complete!");
}

main().catch(console.error);
