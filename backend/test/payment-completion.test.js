const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  completeVotePayment,
  completeTicketPayment,
  completeRegistrationPayment,
  checkInTicket,
  runInBackground,
} = require('../payment-completion');
const {
  createTestDb,
  destroyTestDb,
  seedVoteFixture,
  seedTicketFixture,
} = require('./test-db');

describe('completeVotePayment', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await seedVoteFixture(ctx.db);
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('completes a pending vote and increments nominee tally', async () => {
    const result = await completeVotePayment(ctx.db, 'v_test_ref_001');
    assert.equal(result.outcome, 'completed');
    assert.equal(result.votesAdded, 3);

    const nominee = await ctx.db.get('SELECT votes_count FROM nominees WHERE id = 1');
    assert.equal(nominee.votes_count, 8);

    const vote = await ctx.db.get('SELECT status FROM votes WHERE payment_reference = ?', ['v_test_ref_001']);
    assert.equal(vote.status, 'completed');
  });

  it('is idempotent when webhook is delivered twice sequentially', async () => {
    const first = await completeVotePayment(ctx.db, 'v_test_ref_001');
    const second = await completeVotePayment(ctx.db, 'v_test_ref_001');

    assert.equal(first.outcome, 'completed');
    assert.equal(second.outcome, 'already_completed');

    const nominee = await ctx.db.get('SELECT votes_count FROM nominees WHERE id = 1');
    assert.equal(nominee.votes_count, 8);
  });

  it('handles concurrent duplicate webhooks without double-counting', async () => {
    const results = await Promise.all([
      completeVotePayment(ctx.db, 'v_test_ref_001'),
      completeVotePayment(ctx.db, 'v_test_ref_001'),
      completeVotePayment(ctx.db, 'v_test_ref_001'),
    ]);

    const nominee = await ctx.db.get('SELECT votes_count FROM nominees WHERE id = 1');
    assert.equal(nominee.votes_count, 8);

    const completed = results.filter((r) => r.outcome === 'completed').length;
    const already = results.filter((r) => r.outcome === 'already_completed').length;
    assert.equal(completed + already, 3);
    assert.ok(completed >= 1);
  });

  it('returns not_found for unknown payment reference', async () => {
    const result = await completeVotePayment(ctx.db, 'v_does_not_exist');
    assert.equal(result.outcome, 'not_found');
  });
});

describe('completeTicketPayment', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await seedTicketFixture(ctx.db, { quantity: 2 });
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('marks ticket paid and increments tickets_sold', async () => {
    const result = await completeTicketPayment(ctx.db, 'tix_test_ref_001');
    assert.equal(result.outcome, 'completed');

    const event = await ctx.db.get('SELECT tickets_sold FROM events WHERE id = 1');
    assert.equal(event.tickets_sold, 2);

    const ticket = await ctx.db.get('SELECT payment_status FROM tickets WHERE payment_reference = ?', ['tix_test_ref_001']);
    assert.equal(ticket.payment_status, 'paid');
  });

  it('does not double-increment tickets_sold on retry', async () => {
    await completeTicketPayment(ctx.db, 'tix_test_ref_001');
    await completeTicketPayment(ctx.db, 'tix_test_ref_001');

    const event = await ctx.db.get('SELECT tickets_sold FROM events WHERE id = 1');
    assert.equal(event.tickets_sold, 2);
  });

  it('handles concurrent ticket webhooks safely', async () => {
    await Promise.all([
      completeTicketPayment(ctx.db, 'tix_test_ref_001'),
      completeTicketPayment(ctx.db, 'tix_test_ref_001'),
    ]);

    const event = await ctx.db.get('SELECT tickets_sold FROM events WHERE id = 1');
    assert.equal(event.tickets_sold, 2);
  });
});

describe('completeRegistrationPayment', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await ctx.db.run(
      `INSERT INTO nominee_registrations (name, email, phone, payment_reference, payment_status)
       VALUES (?, ?, ?, ?, 'pending')`,
      ['Applicant', 'a@test.com', '0244111222', 'reg_test_001']
    );
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('completes pending registration once', async () => {
    const first = await completeRegistrationPayment(ctx.db, 'reg_test_001');
    const second = await completeRegistrationPayment(ctx.db, 'reg_test_001');

    assert.equal(first.outcome, 'completed');
    assert.equal(second.outcome, 'already_completed');
  });
});

describe('checkInTicket', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await seedTicketFixture(ctx.db);
    await completeTicketPayment(ctx.db, 'tix_test_ref_001');
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('checks in a paid ticket', async () => {
    const result = await checkInTicket(ctx.db, 'TIX-TEST01');
    assert.equal(result.outcome, 'checked_in');
    assert.equal(result.ticket.buyer_name, 'Buyer');
  });

  it('rejects duplicate check-in at the gate', async () => {
    await checkInTicket(ctx.db, 'TIX-TEST01');
    const second = await checkInTicket(ctx.db, 'TIX-TEST01');
    assert.equal(second.outcome, 'already_scanned');
  });

  it('rejects check-in for unpaid ticket', async () => {
    const unpaidCtx = await createTestDb();
    await seedTicketFixture(unpaidCtx.db);
    const result = await checkInTicket(unpaidCtx.db, 'TIX-TEST01');
    assert.equal(result.outcome, 'unpaid');
    await destroyTestDb(unpaidCtx);
  });

  it('rejects unknown ticket code', async () => {
    const result = await checkInTicket(ctx.db, 'TIX-UNKNOWN');
    assert.equal(result.outcome, 'not_found');
  });

  it('rejects empty ticket code', async () => {
    const result = await checkInTicket(ctx.db, '   ');
    assert.equal(result.outcome, 'invalid_code');
  });
});

describe('runInBackground', () => {
  it('runs async work without blocking the caller', async () => {
    let done = false;
    runInBackground(async () => {
      await new Promise((r) => setTimeout(r, 20));
      done = true;
    });
    assert.equal(done, false);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(done, true);
  });

  it('swallows background errors without throwing to caller', async () => {
    assert.doesNotThrow(() => {
      runInBackground(async () => {
        throw new Error('email provider down');
      });
    });
    await new Promise((r) => setTimeout(r, 10));
  });
});

describe('ticket capacity (oversell guard)', () => {
  let ctx;

  beforeEach(async () => {
    if (ctx) await destroyTestDb(ctx);
    ctx = await createTestDb();
    await ctx.db.run(
      'INSERT INTO events (title, total_tickets, tickets_sold) VALUES (?, ?, ?)',
      ['Small Event', 5, 4]
    );
  });

  after(async () => {
    if (ctx) await destroyTestDb(ctx);
  });

  it('simulates sold-out guard at purchase time', async () => {
    const qty = 2;
    let soldOut = false;
    try {
      await ctx.db.transaction(async (tx) => {
        const capacity = await tx.get('SELECT tickets_sold, total_tickets FROM events WHERE id = 1');
        if (capacity.tickets_sold + qty > capacity.total_tickets) {
          throw new Error('SOLD_OUT');
        }
        await tx.run(
          `INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [1, 'TIX-LATE', 'Late Buyer', 'late@test.com', '0244000001', qty, 20, 'tix_late_001']
        );
      });
    } catch (err) {
      if (err.message === 'SOLD_OUT') soldOut = true;
      else throw err;
    }
    assert.equal(soldOut, true);

    const event = await ctx.db.get('SELECT tickets_sold FROM events WHERE id = 1');
    assert.equal(event.tickets_sold, 4);
  });
});
