const { getDB, initDB } = require('./database');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const codesToRemove = ['3801', '703', '4304', '401'];

async function main() {
  await initDB();
  const db = getDB();
  
  console.log(`Deleting nominees with codes: ${codesToRemove.join(', ')}...`);
  
  for (const code of codesToRemove) {
    const nominee = await db.get("SELECT * FROM nominees WHERE code = ?", [code]);
    if (nominee) {
      console.log(`Found nominee: ${nominee.name} (Code: ${nominee.code}) under category ID: ${nominee.category_id}`);
      await db.run("DELETE FROM nominees WHERE id = ?", [nominee.id]);
      console.log(`Deleted nominee ID: ${nominee.id} from database.`);
      
      // Clean up the photo file locally on the server if it exists
      const photoPath = path.join(__dirname, 'photos', `${code}.jpg`);
      if (fs.existsSync(photoPath)) {
        try {
          fs.unlinkSync(photoPath);
          console.log(`Deleted photo file: ${photoPath}`);
        } catch (err) {
          console.error(`Failed to delete photo file: ${photoPath}`, err);
        }
      }
    } else {
      console.log(`Nominee with code ${code} not found in database.`);
    }
  }

  console.log("✅ Deletion operations complete!");
}

main().catch(console.error);
