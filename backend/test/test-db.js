const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@libsql/client');

function rowToObj(row, columns) {
  if (!row) return undefined;
  const obj = {};
  columns.forEach((col, idx) => {
    obj[col] = row[col] !== undefined ? row[col] : row[idx];
  });
  return obj;
}

function createTestDbWrapper(client) {
  return {
    async get(sql, params) {
      const args = Array.isArray(params) ? params : (params ? [params] : []);
      const result = await client.execute({ sql, args });
      if (result.rows.length === 0) return undefined;
      return rowToObj(result.rows[0], result.columns);
    },

    async all(sql, params) {
      const args = Array.isArray(params) ? params : (params ? [params] : []);
      const result = await client.execute({ sql, args });
      return result.rows.map((row) => rowToObj(row, result.columns));
    },

    async run(sql, params) {
      const args = Array.isArray(params) ? params : (params ? [params] : []);
      const result = await client.execute({ sql, args });
      return {
        lastID: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
        changes: result.rowsAffected,
      };
    },

    async exec(sql) {
      if (sql.includes(';')) {
        await client.executeMultiple(sql);
      } else {
        await client.execute(sql);
      }
    },

    async transaction(fn) {
      await client.execute('BEGIN IMMEDIATE');
      try {
        const result = await fn(createTestDbWrapper(client));
        await client.execute('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.execute('ROLLBACK');
        } catch (_) { /* ignore */ }
        throw err;
      }
    },
  };
}

const SCHEMA = `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    total_tickets INTEGER DEFAULT 100,
    tickets_sold INTEGER DEFAULT 0
  );
  CREATE TABLE nominees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    photo_url TEXT,
    category_id INTEGER NOT NULL,
    passcode TEXT DEFAULT '',
    votes_count INTEGER DEFAULT 0
  );
  CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nominee_id INTEGER NOT NULL,
    vote_count INTEGER NOT NULL,
    channel TEXT NOT NULL DEFAULT 'web',
    payment_reference TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    receipt_sent INTEGER DEFAULT 0
  );
  CREATE TABLE tickets (
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
    scanned_at DATETIME
  );
  CREATE TABLE nominee_registrations (
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
    activation_pin TEXT
  );
`;

async function createTestDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voteeq-test-'));
  const dbPath = path.join(dir, 'test.db').replace(/\\/g, '/');
  const client = createClient({ url: `file:${dbPath}` });
  const db = createTestDbWrapper(client);
  await db.exec(SCHEMA);
  return { db, client, dir };
}

async function destroyTestDb({ client, dir }) {
  if (client) {
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') {
      throw err;
    }
  }
}

async function seedVoteFixture(db) {
  await db.run('INSERT INTO categories (name) VALUES (?)', ['Test Category']);
  await db.run(
    'INSERT INTO nominees (code, name, category_id, votes_count) VALUES (?, ?, ?, ?)',
    ['101', 'Test Nominee', 1, 5]
  );
  await db.run(
    `INSERT INTO votes (nominee_id, vote_count, channel, payment_reference, status)
     VALUES (?, ?, 'web', ?, 'pending')`,
    [1, 3, 'v_test_ref_001']
  );
  return { nomineeId: 1, reference: 'v_test_ref_001', initialVotes: 5, voteCount: 3 };
}

async function seedTicketFixture(db, { totalTickets = 10, ticketsSold = 0, quantity = 2 } = {}) {
  await db.run(
    'INSERT INTO events (title, total_tickets, tickets_sold) VALUES (?, ?, ?)',
    ['Test Event', totalTickets, ticketsSold]
  );
  await db.run(
    `INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [1, 'TIX-TEST01', 'Buyer', 'buyer@test.com', '0244000000', quantity, 50, 'tix_test_ref_001']
  );
  return { eventId: 1, reference: 'tix_test_ref_001', ticketCode: 'TIX-TEST01', quantity };
}

module.exports = {
  createTestDb,
  destroyTestDb,
  seedVoteFixture,
  seedTicketFixture,
};
