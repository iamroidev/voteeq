require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { initDB } = require('./database');


async function run() {
  console.log('Starting DB initialization and check...');
  // Force seed if env vars are set
  process.env.FORCE_ACSES_RESEED = 'true';
  process.env.SEED_ACSES_AWARDS = 'true';
  
  await initDB();
  console.log('Database reseed completed successfully!');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reseed failed:', err);
    process.exit(1);
  });
