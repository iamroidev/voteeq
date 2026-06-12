const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const { hashPin, isProduction } = require('./security');
const { CAMPUS_EVENTS, CAMPUS_CATEGORIES, CAMPUS_NOMINEES } = require('./seed-campus');

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
  },

  async transaction(fn) {
    await client.execute('BEGIN IMMEDIATE');
    try {
      const result = await fn(dbWrapper);
      await client.execute('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.execute('ROLLBACK');
      } catch (_) { /* ignore */ }
      throw err;
    }
  }
};

async function initDB() {
  if (client) return dbWrapper;

  const localUrl = 'file:' + path.resolve(dbPath).replace(/\\/g, '/');
  const url = process.env.TURSO_DATABASE_URL || localUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (isProduction() && !process.env.TURSO_DATABASE_URL) {
    throw new Error('TURSO_DATABASE_URL is required in production');
  }

  console.log(`Connecting database to: ${url.startsWith('file:') ? 'Local SQLite file' : 'Turso Cloud SQLite'}`);

  client = createClient({
    url,
    authToken
  });

  try {
    await client.execute('PRAGMA foreign_keys = ON;');
  } catch (e) {
    console.warn('Could not enable foreign keys:', e.message);
  }

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

  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_votes_payment_reference ON votes(payment_reference);');
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_tickets_payment_reference ON tickets(payment_reference);');
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON tickets(ticket_code);');
  await dbWrapper.exec('CREATE INDEX IF NOT EXISTS idx_nominees_code ON nominees(code);');

  const allowCampusSeed = !isProduction() || process.env.SEED_CAMPUS_DEMO === 'true';

  if (allowCampusSeed && process.env.FORCE_CAMPUS_RESEED === 'true') {
    console.warn('FORCE_CAMPUS_RESEED: clearing demo events, categories, nominees, votes, and tickets...');
    await dbWrapper.run('DELETE FROM votes');
    await dbWrapper.run('DELETE FROM tickets');
    await dbWrapper.run('DELETE FROM nominees');
    await dbWrapper.run('DELETE FROM nominee_registrations');
    await dbWrapper.run('DELETE FROM categories');
    await dbWrapper.run('DELETE FROM events');
  }

  if (allowCampusSeed) {
    let eventCount = await dbWrapper.get('SELECT COUNT(*) as count FROM events');
    if (eventCount.count === 0) {
      console.log('Seeding campus demo events...');
      for (const event of CAMPUS_EVENTS) {
        await dbWrapper.run(
          `INSERT INTO events (title, description, date, venue, ticket_price, privacy, access_code, total_tickets, tickets_sold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            event.title,
            event.description,
            event.date,
            event.venue,
            event.ticket_price,
            event.privacy,
            event.access_code,
            event.total_tickets,
          ]
        );
      }
      eventCount = { count: CAMPUS_EVENTS.length };
    }

    let categoryCount = await dbWrapper.get('SELECT COUNT(*) as count FROM categories');
    if (categoryCount.count === 0) {
      console.log('Seeding campus demo categories...');
      for (const [name, description] of CAMPUS_CATEGORIES) {
        await dbWrapper.run(
          'INSERT INTO categories (name, description) VALUES (?, ?)',
          [name, description]
        );
      }
      categoryCount = { count: CAMPUS_CATEGORIES.length };
    }

    const nomineeCount = await dbWrapper.get('SELECT COUNT(*) as count FROM nominees');
    if (nomineeCount.count === 0 && categoryCount.count > 0 && eventCount.count > 0) {
      console.log('Seeding campus demo nominees (hashed PINs)...');
      for (const [code, name, photo, catId, eventId, pin, votes] of CAMPUS_NOMINEES) {
        const hashedPin = await hashPin(pin);
        await dbWrapper.run(
          'INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [code, name, photo, catId, eventId, hashedPin, votes]
        );
      }
    }
  }

  return dbWrapper;
}

module.exports = {
  initDB,
  getDB: () => dbWrapper
};
