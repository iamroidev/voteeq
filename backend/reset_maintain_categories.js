require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { initDB, resetAllButCategories } = require('./database');

async function run() {
  console.log('Connecting to database...');
  const db = await initDB();
  
  console.log('Resetting all except categories...');
  await resetAllButCategories(db);
  
  console.log('Reset completed successfully! Categories were maintained.');
}


run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
