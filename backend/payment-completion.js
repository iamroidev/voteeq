/**
 * Atomic payment completion and ticket check-in.
 * Used by webhooks and mock-verify paths so concurrent retries cannot double-count.
 */

const inFlightByReference = new Map();

function dedupeByReference(reference, fn) {
  const key = String(reference);
  if (inFlightByReference.has(key)) {
    return inFlightByReference.get(key);
  }
  const promise = Promise.resolve().then(fn).finally(() => {
    inFlightByReference.delete(key);
  });
  inFlightByReference.set(key, promise);
  return promise;
}

function runInBackground(task) {
  Promise.resolve()
    .then(task)
    .catch((err) => console.error('Background task failed:', err));
}

/**
 * Complete a vote payment exactly once (idempotent under concurrent webhooks).
 * @returns {Promise<{ outcome: 'completed'|'already_completed'|'not_found', vote?: object, votesAdded?: number }>}
 */
async function completeVotePayment(db, reference) {
  return dedupeByReference(reference, () => completeVotePaymentTx(db, reference));
}

async function completeVotePaymentTx(db, reference) {
  return db.transaction(async (tx) => {
    const vote = await tx.get('SELECT * FROM votes WHERE payment_reference = ?', [reference]);
    if (!vote) {
      return { outcome: 'not_found' };
    }

    const updated = await tx.run(
      "UPDATE votes SET status = 'completed' WHERE id = ? AND status = 'pending'",
      [vote.id]
    );

    if (!updated.changes) {
      return { outcome: 'already_completed', vote };
    }

    await tx.run(
      'UPDATE nominees SET votes_count = votes_count + ? WHERE id = ?',
      [vote.vote_count, vote.nominee_id]
    );

    return {
      outcome: 'completed',
      vote,
      votesAdded: vote.vote_count,
      nomineeId: vote.nominee_id,
    };
  });
}

/**
 * Complete a ticket payment exactly once.
 */
async function completeTicketPayment(db, reference) {
  return dedupeByReference(reference, () => completeTicketPaymentTx(db, reference));
}

async function completeTicketPaymentTx(db, reference) {
  return db.transaction(async (tx) => {
    const ticket = await tx.get('SELECT * FROM tickets WHERE payment_reference = ?', [reference]);
    if (!ticket) {
      return { outcome: 'not_found' };
    }

    const updated = await tx.run(
      "UPDATE tickets SET payment_status = 'paid' WHERE id = ? AND payment_status = 'pending'",
      [ticket.id]
    );

    if (!updated.changes) {
      return { outcome: 'already_completed', ticket };
    }

    await tx.run(
      'UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?',
      [ticket.quantity, ticket.event_id]
    );

    return { outcome: 'completed', ticket };
  });
}

/**
 * Complete a nominee registration form payment exactly once.
 */
async function completeRegistrationPayment(db, reference) {
  return dedupeByReference(reference, () => completeRegistrationPaymentTx(db, reference));
}

async function completeRegistrationPaymentTx(db, reference) {
  return db.transaction(async (tx) => {
    const reg = await tx.get('SELECT * FROM nominee_registrations WHERE payment_reference = ?', [reference]);
    if (!reg) {
      return { outcome: 'not_found' };
    }

    const updated = await tx.run(
      "UPDATE nominee_registrations SET payment_status = 'completed' WHERE id = ? AND payment_status = 'pending'",
      [reg.id]
    );

    if (!updated.changes) {
      return { outcome: 'already_completed', registration: reg };
    }

    return { outcome: 'completed', registration: reg };
  });
}

/**
 * Check in a paid ticket exactly once.
 */
async function checkInTicket(db, ticketCode) {
  const trimmed = String(ticketCode || '').trim();
  if (!trimmed) {
    return { outcome: 'invalid_code' };
  }

  return dedupeByReference(`scan:${trimmed}`, () => checkInTicketTx(db, trimmed));
}

async function checkInTicketTx(db, trimmed) {
  return db.transaction(async (tx) => {
    const ticket = await tx.get(`
      SELECT t.*, e.title as event_title
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.ticket_code = ?
    `, [trimmed]);

    if (!ticket) {
      return { outcome: 'not_found' };
    }

    if (ticket.payment_status !== 'paid') {
      return { outcome: 'unpaid', ticket };
    }

    const scannedAt = new Date().toISOString();
    const updated = await tx.run(
      "UPDATE tickets SET scanned = 1, scanned_at = ? WHERE id = ? AND scanned = 0 AND payment_status = 'paid'",
      [scannedAt, ticket.id]
    );

    if (!updated.changes) {
      return { outcome: 'already_scanned', ticket };
    }

    return {
      outcome: 'checked_in',
      ticket: {
        buyer_name: ticket.buyer_name,
        event_title: ticket.event_title,
        quantity: ticket.quantity,
        scanned_at: scannedAt,
      },
    };
  });
}

module.exports = {
  runInBackground,
  completeVotePayment,
  completeTicketPayment,
  completeRegistrationPayment,
  checkInTicket,
};
