const { createClient } = require('@libsql/client');
require('dotenv').config();

async function run() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  const resEvents = await client.execute('SELECT * FROM events');
  console.log('Events in DB:', resEvents.rows);

  const resCategories = await client.execute('SELECT * FROM categories');
  console.log('Categories in DB:', resCategories.rows);
}

run().catch(console.error);
