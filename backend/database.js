const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const { fixAscesSpelling } = require('./acses-spelling');
const { CAMPUS_EVENTS, CAMPUS_CATEGORIES, CAMPUS_NOMINEES } = require('./seed-campus');
const { ACSES_EVENT } = require('./seed-acses');
const { ACSES_AWARD_CATEGORIES } = require('./seed-acses-categories');

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
    await dbWrapper.exec('ALTER TABLE votes ADD COLUMN amount_base REAL;');
  } catch (e) {
    // Suppress if column already exists
  }
  try {
    await dbWrapper.exec('ALTER TABLE votes ADD COLUMN amount_fee REAL;');
  } catch (e) {
    // Suppress if column already exists
  }
  try {
    await dbWrapper.exec('ALTER TABLE votes ADD COLUMN amount_paid REAL;');
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

  const allowACSESSeed = !isProduction() || process.env.SEED_ACSES_AWARDS === 'true';
  const allowCampusSeed = process.env.SEED_CAMPUS_DEMO === 'true';

  if (allowACSESSeed && process.env.FORCE_ACSES_RESEED === 'true') {
    console.warn('FORCE_ACSES_RESEED: resetting catalog for ACSES Awards...');
    await reseedACSESAwards(dbWrapper);
  } else if (allowACSESSeed) {
    await seedACSESIfEmpty(dbWrapper);
  } else if (allowCampusSeed && process.env.FORCE_CAMPUS_RESEED === 'true') {
    console.warn('FORCE_CAMPUS_RESEED: replacing demo catalog with campus data...');
    await reseedCampusDemo(dbWrapper);
  } else if (allowCampusSeed) {
    await seedCampusDemoIfEmpty(dbWrapper);
  }

  await normalizeLegacyEventDates(dbWrapper);
  await fixLegacyAscesSpelling(dbWrapper);

  return dbWrapper;
}

async function clearCampusDemoData(db) {
  await clearCatalogData(db);
}

async function insertCampusDemoEvents(db) {
  const eventIds = [];
  for (const event of CAMPUS_EVENTS) {
    const result = await db.run(
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
    eventIds.push(result.lastID);
  }
  return eventIds;
}

async function insertCampusDemoCategories(db) {
  const categoryIds = [];
  for (const [name, description] of CAMPUS_CATEGORIES) {
    const result = await db.run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );
    categoryIds.push(result.lastID);
  }
  return categoryIds;
}

async function insertCampusDemoNominees(db, eventIds, categoryIds, hashedPins = null) {
  let pinIndex = 0;
  for (const [code, name, photo, catIdx, eventIdx, pin, votes] of CAMPUS_NOMINEES) {
    const categoryId = categoryIds[catIdx - 1];
    const eventId = eventIds[eventIdx - 1];
    if (!categoryId || !eventId) {
      throw new Error(`Campus seed mapping failed for nominee ${code}`);
    }
    const passcode = hashedPins ? hashedPins[pinIndex] : await hashPin(pin);
    pinIndex += 1;
    await db.run(
      'INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, name, photo, categoryId, eventId, passcode, votes]
    );
  }
}

async function insertCampusDemoData(db) {
  const eventIds = await insertCampusDemoEvents(db);
  const categoryIds = await insertCampusDemoCategories(db);
  const hashedPins = await Promise.all(CAMPUS_NOMINEES.map(([, , , , , pin]) => hashPin(pin)));
  await insertCampusDemoNominees(db, eventIds, categoryIds, hashedPins);
}

async function seedCampusDemoIfEmpty(db) {
  let eventCount = await db.get('SELECT COUNT(*) as count FROM events');
  if (eventCount.count === 0) {
    console.log('Seeding campus demo events...');
    await insertCampusDemoEvents(db);
    eventCount = { count: CAMPUS_EVENTS.length };
  }

  let categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (categoryCount.count === 0) {
    console.log('Seeding campus demo categories...');
    await insertCampusDemoCategories(db);
    categoryCount = { count: CAMPUS_CATEGORIES.length };
  }

  const nomineeCount = await db.get('SELECT COUNT(*) as count FROM nominees');
  if (nomineeCount.count === 0 && categoryCount.count > 0 && eventCount.count > 0) {
    console.log('Seeding campus demo nominees (hashed PINs)...');
    const events = await db.all(
      'SELECT id FROM events ORDER BY id ASC LIMIT ?',
      [CAMPUS_EVENTS.length]
    );
    const categories = await db.all(
      'SELECT id FROM categories ORDER BY id ASC LIMIT ?',
      [CAMPUS_CATEGORIES.length]
    );
    const eventIds = events.map((row) => row.id);
    const categoryIds = categories.map((row) => row.id);
    await insertCampusDemoNominees(db, eventIds, categoryIds);
  }
}

async function clearCatalogData(db) {
  await db.run('DELETE FROM votes');
  await db.run('DELETE FROM tickets');
  await db.run('DELETE FROM nominees');
  await db.run('DELETE FROM nominee_registrations');
  await db.run('DELETE FROM categories');
  await db.run('DELETE FROM events');
}

async function insertACSESCategories(db) {
  for (const [name, description] of ACSES_AWARD_CATEGORIES) {
    await db.run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );
  }
}

async function insertACSESEvent(db) {
  const event = ACSES_EVENT;
  const result = await db.run(
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
  return result.lastID;
}

async function seedACSESIfEmpty(db) {
  const eventCount = await db.get('SELECT COUNT(*) as count FROM events');
  if (eventCount.count === 0) {
    console.log('Seeding ACSES Awards event...');
    await insertACSESEvent(db);
  }

  const categoryCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (categoryCount.count === 0) {
    console.log('Seeding ACSES award categories...');
    await insertACSESCategories(db);
  }
}

async function normalizeLegacyEventDates(db) {
  const legacyDates = new Set(['26', "'26", '\u201926']);
  try {
    const events = await db.all('SELECT id, date FROM events');
    for (const ev of events || []) {
      const trimmed = String(ev.date ?? '').trim();
      if (legacyDates.has(trimmed)) {
        await db.run('UPDATE events SET date = ? WHERE id = ?', ['2026', ev.id]);
      }
    }
  } catch (err) {
    console.warn('normalizeLegacyEventDates skipped:', err.message);
  }
}

async function fixLegacyAscesSpelling(db) {
  try {
    const events = await db.all('SELECT id, title, description FROM events');
    for (const ev of events || []) {
      const title = fixAscesSpelling(ev.title);
      const description = fixAscesSpelling(ev.description);
      if (title !== ev.title || description !== ev.description) {
        await db.run('UPDATE events SET title = ?, description = ? WHERE id = ?', [title, description, ev.id]);
        console.log(`Fixed ASCES→ACSES spelling for event #${ev.id}`);
      }
    }
  } catch (err) {
    console.warn('fixLegacyAscesSpelling skipped:', err.message);
  }
}

async function reseedACSESAwards(db) {
  try {
    await db.transaction(async (tx) => {
      await clearCatalogData(tx);
      await insertACSESEvent(tx);
      await insertACSESCategories(tx);
    });
  } catch (txErr) {
    console.warn('ACSES reseed transaction failed, retrying without transaction:', txErr.message);
    await clearCatalogData(db);
    await insertACSESEvent(db);
    await insertACSESCategories(db);
  }
  await normalizeLegacyEventDates(db);
}

async function reseedCampusDemo(db) {
  const hashedPins = await Promise.all(CAMPUS_NOMINEES.map(([, , , , , pin]) => hashPin(pin)));

  try {
    await db.transaction(async (tx) => {
      await clearCampusDemoData(tx);
      const eventIds = await insertCampusDemoEvents(tx);
      const categoryIds = await insertCampusDemoCategories(tx);
      await insertCampusDemoNominees(tx, eventIds, categoryIds, hashedPins);
    });
  } catch (txErr) {
    console.warn('Campus reseed transaction failed, retrying without transaction:', txErr.message);
    await clearCampusDemoData(db);
    const eventIds = await insertCampusDemoEvents(db);
    const categoryIds = await insertCampusDemoCategories(db);
    await insertCampusDemoNominees(db, eventIds, categoryIds, hashedPins);
  }
}

module.exports = {
  initDB,
  getDB: () => dbWrapper,
  reseedACSESAwards,
  reseedCampusDemo,
};
