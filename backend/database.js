how const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

// For Render, use /var/data if available (persistent disk), otherwise use db/ subdir
const dbDir = process.env.RENDER_PERSISTENT_DIR 
  ? path.join(process.env.RENDER_PERSISTENT_DIR, 'db')
  : path.join(__dirname, 'db');

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'voteeq.db');

let db = null;

async function initDB() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable WAL mode for concurrency
  await db.exec('PRAGMA journal_mode = WAL;');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nominees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT,
      category_id INTEGER NOT NULL,
      passcode TEXT NOT NULL,
      votes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nominee_id INTEGER NOT NULL,
      voter_phone TEXT,
      vote_count INTEGER NOT NULL,
      channel TEXT NOT NULL, -- 'web' or 'ussd'
      payment_reference TEXT UNIQUE,
      status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nominee_id) REFERENCES nominees(id)
    );
  `);

  // Seed default data if database is empty
  const categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (categoryCount.count === 0) {
    console.log('Seeding initial database categories and nominees...');
    
    // Seed categories
    await db.run("INSERT INTO categories (name, description) VALUES ('Artist of the Year', 'Outstanding creative musical talent')");
    await db.run("INSERT INTO categories (name, description) VALUES ('Best New Artist', 'Most promising breakthrough talent')");
    await db.run("INSERT INTO categories (name, description) VALUES ('Album of the Year', 'Exceptional collection of musical works')");

    // Seed nominees
    // Passcode for demo: '1234' for simplicity. In production we would hash. We will store plain or basic hashed. Let's store '1234'.
    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('101', 'Stonebwoy', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80', 1, '1234', 1250)");
    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('102', 'Shatta Wale', 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80', 1, '4321', 890)");
    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('103', 'Sarkodie', 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&q=80', 1, '9999', 1420)");

    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('201', 'Black Sherif', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80', 2, '1111', 2300)");
    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('202', 'King Promise', 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80', 2, '2222', 1500)");

    await db.run("INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES ('301', '5th Dimension', 'https://images.unsplash.com/photo-1487180142328-054b783fc471?w=500&q=80', 3, '3333', 350)");
  }

  return db;
}

module.exports = {
  initDB,
  getDB: () => db
};