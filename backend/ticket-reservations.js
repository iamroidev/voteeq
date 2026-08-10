const TICKET_RESERVATION_HOLD_MINUTES = 30;

async function getTicketCapacity(tx, eventId) {
  return tx.get(`
    SELECT
      e.total_tickets,
      e.tickets_sold,
      COALESCE(SUM(CASE WHEN t.payment_status = 'pending' THEN t.quantity ELSE 0 END), 0) AS tickets_pending
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id
    WHERE e.id = ?
    GROUP BY e.id, e.total_tickets, e.tickets_sold
  `, [eventId]);
}

async function ensureTicketCapacityAvailable(tx, eventId, quantity) {
  const capacity = await getTicketCapacity(tx, eventId);
  if (
    !capacity ||
    Number(capacity.tickets_sold || 0) + Number(capacity.tickets_pending || 0) + quantity > Number(capacity.total_tickets || 0)
  ) {
    throw new Error('SOLD_OUT');
  }
  return capacity;
}

async function ensurePaidTicketCapacity(tx, eventId, quantity) {
  const capacity = await tx.get(
    'SELECT tickets_sold, total_tickets FROM events WHERE id = ?',
    [eventId]
  );
  if (
    !capacity ||
    Number(capacity.tickets_sold || 0) + quantity > Number(capacity.total_tickets || 0)
  ) {
    throw new Error('SOLD_OUT');
  }
  return capacity;
}

async function cleanupStaleTicketReservations(db) {
  const result = await db.run(`
    UPDATE tickets
    SET payment_status = 'expired'
    WHERE payment_status = 'pending'
      AND created_at < datetime('now', ?)
  `, [`-${TICKET_RESERVATION_HOLD_MINUTES} minutes`]);
  return result;
}

module.exports = {
  TICKET_RESERVATION_HOLD_MINUTES,
  cleanupStaleTicketReservations,
  ensurePaidTicketCapacity,
  ensureTicketCapacityAvailable,
  getTicketCapacity,
};
