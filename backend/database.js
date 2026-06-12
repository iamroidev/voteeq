const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

// Support local volume fallback (e.g. Railway volume or local dev folder)
const dbDir = process.env.RAILWAY_VOLUME_MOUNT 
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT, 'db')
  : path.join(__dirname, 'db');

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'voteeq.db');

let client = null;

function rowToObj(row, columns) {
  if (!row) return undefined;
  const obj = {};
  columns.forEach((col, idx) => {
    obj[col] = row[col] !== undefined ? row[col] : row[idx];
  });
  return obj;
}

// A wrapper object to emulate the sqlite/sqlite3 api used in server.js
const dbWrapper = {
  async get(sql, params) {
    const args = Array.isArray(params) ? params : (params ? [params] : []);
    const result = await client.execute({ sql, args });
    if (result.rows.length === 0) return undefined;
    return rowToObj(result.rows[0], result.columns);
  },

  async all(sql, params) {
    const args = Array.isArray(params) ? params : (params ? [params] : []);
    const result = await client.execute({ sql, args });
    return result.rows.map(row => rowToObj(row, result.columns));
  },

  async run(sql, params) {
    const args = Array.isArray(params) ? params : (params ? [params] : []);
    const result = await client.execute({ sql, args });
    return {
      lastID: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
      changes: result.rowsAffected
    };
  },

  async exec(sql) {
    // If the input sql contains multiple statements separated by semicolons, run executeMultiple
    if (sql.includes(';')) {
      await client.executeMultiple(sql);
    } else {
      await client.execute(sql);
    }
  }
};

async function initDB() {
  if (client) return dbWrapper;

  const localUrl = 'file:' + path.resolve(dbPath).replace(/\\/g, '/');
  const url = process.env.TURSO_DATABASE_URL || localUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log(`Connecting database to: ${url.startsWith('file:') ? 'Local SQLite file' : 'Turso Cloud SQLite'}`);

  client = createClient({
    url,
    authToken
  });

  // Enable WAL mode for local file connections
  if (url.startsWith('file:')) {
    try {
      await client.execute('PRAGMA journal_mode = WAL;');
    } catch (e) {
      console.warn('Could not enable WAL mode:', e.message);
    }
  }

  // Create tables
  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS nominees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT,
      category_id INTEGER NOT NULL,
      event_id INTEGER,
      passcode TEXT NOT NULL,
      votes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nominee_id INTEGER NOT NULL,
      voter_phone TEXT,
      email TEXT,
      vote_count INTEGER NOT NULL,
      channel TEXT NOT NULL,
      payment_reference TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      receipt_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nominee_id) REFERENCES nominees(id)
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS nominee_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      photo_url TEXT,
      category_id INTEGER,
      custom_category TEXT,
      bio TEXT,
      payment_reference TEXT UNIQUE,
      payment_status TEXT DEFAULT 'pending',
      form_fee REAL DEFAULT 10.00,
      approval_status TEXT DEFAULT 'pending',
      nominee_code TEXT,
      activation_pin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      venue TEXT,
      ticket_price REAL DEFAULT 0.0,
      privacy TEXT DEFAULT 'public',
      access_code TEXT,
      total_tickets INTEGER DEFAULT 100,
      tickets_sold INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      ticket_code TEXT UNIQUE NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      price_paid REAL NOT NULL,
      payment_reference TEXT UNIQUE NOT NULL,
      payment_status TEXT DEFAULT 'pending',
      scanned INTEGER DEFAULT 0,
      scanned_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
  `);

  await dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_username TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Dynamically run schema migrations for older local databases if needed
  try {
    await dbWrapper.exec('ALTER TABLE votes ADD COLUMN email TEXT;');
  } catch (e) {
    // Suppress if column already exists
  }
  try {
    await dbWrapper.exec('ALTER TABLE votes ADD COLUMN receipt_sent INTEGER DEFAULT 0;');
  } catch (e) {
    // Suppress if column already exists
  }
  try {
    await dbWrapper.exec('ALTER TABLE nominees ADD COLUMN event_id INTEGER;');
  } catch (e) {
    // Suppress if column already exists
  }

  // Seed default data if database is empty
  const categoryCount = await dbWrapper.get('SELECT COUNT(*) as count FROM categories');
  if (categoryCount.count === 0) {
    console.log('Seeding initial database categories and nominees...');
    
    // Seed categories
    await dbWrapper.run("INSERT INTO categories (name, description) VALUES ('Artist of the Year', 'Outstanding creative musical talent')");
    await dbWrapper.run("INSERT INTO categories (name, description) VALUES ('Best New Artist', 'Most promising breakthrough talent')");
    await dbWrapper.run("INSERT INTO categories (name, description) VALUES ('Album of the Year', 'Exceptional collection of musical works')");

    // Seed nominees
    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('101', 'Stonebwoy', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80', 1, 1, '1234', 1250)");
    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('102', 'Shatta Wale', 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80', 1, 1, '4321', 890)");
    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('103', 'Sarkodie', 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=500&q=80', 1, 1, '9999', 1420)");

    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('201', 'Black Sherif', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80', 2, 1, '1111', 2300)");
    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('202', 'King Promise', 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80', 2, 1, '2222', 1500)");

    await dbWrapper.run("INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES ('301', '5th Dimension', 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&q=80', 3, 1, '3333', 350)");
  }

  // Seed default events if empty
  const eventCount = await dbWrapper.get('SELECT COUNT(*) as count FROM events');
  if (eventCount.count === 0) {
    console.log('Seeding initial database events...');
    await dbWrapper.run("INSERT INTO events (title, description, date, venue, ticket_price, privacy, total_tickets, tickets_sold) VALUES ('Voteeq Awards Night', 'Celebrate excellence in musical art and performances.', '2026-07-25', 'National Theatre, Accra', 50.0, 'public', 200, 0)");
    await dbWrapper.run("INSERT INTO events (title, description, date, venue, ticket_price, privacy, access_code, total_tickets, tickets_sold) VALUES ('VIP Afterparty', 'VIP Private Gathering for nominees and special guests.', '2026-07-26', 'Skybar 25, Accra', 150.0, 'private', 'VIP2026', 50, 0)");
  }

  return dbWrapper;
}

module.exports = {
  initDB,
  getDB: () => dbWrapper
};
