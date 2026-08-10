const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanupStaleTicketReservations,
  ensureTicketCapacityAvailable,
  getTicketCapacity,
} = require('../ticket-reservations');
const { createTestDb, destroyTestDb } = require('./test-db');

describe('ticket reservation capacity', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('counts pending reservations before allowing another checkout', async () => {
    await ctx.db.run(
      'INSERT INTO events (title, total_tickets, tickets_sold) VALUES (?, ?, ?)',
      ['Small Event', 5, 4]
    );
    await ctx.db.run(
      `INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 'TIX-HOLD', 'Buyer', 'buyer@test.com', '0244000000', 1, 20, 'tix_hold_001']
    );

    await assert.rejects(
      () => ctx.db.transaction((tx) => ensureTicketCapacityAvailable(tx, 1, 1)),
      /SOLD_OUT/
    );

    const capacity = await getTicketCapacity(ctx.db, 1);
    assert.equal(capacity.tickets_sold, 4);
    assert.equal(capacity.tickets_pending, 1);
  });

  it('expires stale pending reservations without deleting payment references', async () => {
    await ctx.db.run(
      'INSERT INTO events (title, total_tickets, tickets_sold) VALUES (?, ?, ?)',
      ['Timed Event', 5, 0]
    );
    await ctx.db.run(
      `INSERT INTO tickets (
        event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity,
        price_paid, payment_reference, payment_status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now', '-31 minutes'))`,
      [1, 'TIX-OLD', 'Old Buyer', 'old@test.com', '0244000001', 1, 20, 'tix_old_001']
    );
    await ctx.db.run(
      `INSERT INTO tickets (
        event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity,
        price_paid, payment_reference, payment_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [1, 'TIX-NEW', 'New Buyer', 'new@test.com', '0244000002', 1, 20, 'tix_new_001']
    );

    const result = await cleanupStaleTicketReservations(ctx.db);
    assert.equal(result.changes, 1);

    const oldTicket = await ctx.db.get(
      'SELECT payment_status FROM tickets WHERE payment_reference = ?',
      ['tix_old_001']
    );
    const newTicket = await ctx.db.get(
      'SELECT payment_status FROM tickets WHERE payment_reference = ?',
      ['tix_new_001']
    );

    assert.equal(oldTicket.payment_status, 'expired');
    assert.equal(newTicket.payment_status, 'pending');
  });
});
