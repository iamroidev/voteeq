import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function EventsTicketsPage({ isTab, onBack, onPaymentRedirect, activeEventId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Checkout/Booking form state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [accessCode, setAccessCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  // Ticket Lookup States
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupSuccess, setLookupSuccess] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  const handleLookupTickets = async (e) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/tickets/lookup?query=${encodeURIComponent(lookupQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          setLookupError('No active paid tickets found for this query.');
        } else {
          // Merge retrieved tickets into localStorage list
          const saved = localStorage.getItem('voteeq_purchased_tickets');
          const ticketsList = saved ? JSON.parse(saved) : [];
          let addedCount = 0;
          data.forEach(retrieved => {
            if (!ticketsList.some(t => t.ticket_code === retrieved.ticket_code)) {
              ticketsList.push(retrieved);
              addedCount++;
            }
          });
          localStorage.setItem('voteeq_purchased_tickets', JSON.stringify(ticketsList));
          setPurchasedTickets(ticketsList);
          setLookupSuccess(`Successfully retrieved ${data.length} ticket(s) (including ${addedCount} new) and synced to this device!`);
          setLookupQuery('');
        }
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retrieve tickets.');
      }
    } catch (err) {
      setLookupError(err.message || 'An error occurred during ticket lookup.');
    } finally {
      setLookupLoading(false);
    }
  };
  
  // Local list of tickets bought during this session (to make mock scanning verification easy)
  const [purchasedTickets, setPurchasedTickets] = useState(() => {
    const saved = localStorage.getItem('voteeq_purchased_tickets');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const reloadTickets = () => {
      const saved = localStorage.getItem('voteeq_purchased_tickets');
      setPurchasedTickets(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener('storage', reloadTickets);
    window.addEventListener('ticket-purchased', reloadTickets);
    return () => {
      window.removeEventListener('storage', reloadTickets);
      window.removeEventListener('ticket-purchased', reloadTickets);
    };
  }, []);

  useEffect(() => {
    setEventFilter(activeEventId ? String(activeEventId) : 'all');
  }, [activeEventId]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      } else {
        throw new Error('Failed to load events data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const visibleEvents = eventFilter === 'all'
    ? events
    : events.filter(ev => String(ev.id) === String(eventFilter));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, []);

  const handleBuyTickets = (event) => {
    setSelectedEvent(event);
    setBuyerName('');
    setBuyerEmail('');
    setBuyerPhone('');
    setQuantity(1);
    setAccessCode('');
    setCheckoutError('');
    // Scroll to the checkout form
    setTimeout(() => {
      document.getElementById('ticket-checkout-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setCheckoutError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          quantity: parseInt(quantity, 10),
          access_code: accessCode
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize ticket checkout');
      }

      // Intercept onComplete of Paystack to save to local storage for test scanner
      // We pass a payload so App.jsx knows it's a ticket purchase
      onPaymentRedirect({
        ...data,
        isTicket: true,
        eventTitle: selectedEvent.title,
        quantity: parseInt(quantity, 10),
        amount: selectedEvent.ticket_price * parseInt(quantity, 10),
        phone: buyerPhone,
        onSuccessCallback: () => {
          // After success, reload list and save ticket locally so nominee/admin can inspect
          fetchEvents();
          // We can't know the exact code generated by the server until we fetch the ticket or query it.
          // Since it's a mock checkout, let's fetch tickets via the server or approximate it
          // We will let the user know they can find it in the receipts log or admin dashboard.
        }
      });
      
      setSelectedEvent(null);
    } catch (err) {
      setCheckoutError(err.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '2rem 1.5rem 6rem 1.5rem' }}>
      {!isTab && (
        <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2.5rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
          ← Back to Portal
        </button>
      )}

      <div className="editorial-header-section" style={{ marginBottom: '3rem' }}>
        <span className="editorial-tagline">2-IN-1 ELECTIONS & TICKETING</span>
        <h1 className="editorial-title">EVENT TICKETS</h1>
        <div className="editorial-divider" />
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '1rem auto 0 auto', lineHeight: 1.6 }}>
          Get your passes securely to the official Voteeq Awards Night. Select between the standard entry pass or the exclusive VIP afterparty package.
        </p>
        {events.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Event Filter
            </span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="luxury-select"
              style={{ padding: '0.55rem 0.75rem', fontSize: '0.7rem' }}
            >
              <option value="all">All Events</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', padding: '1rem', fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
            Events Catalog Loading...
          </h2>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem' }}>
          {            visibleEvents.length === 0 ? (
            <div className="editorial-sheet" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No events are currently scheduled.</p>
            </div>
          ) : (
            visibleEvents.map(ev => {
              const ticketsLeft = ev.total_tickets - ev.tickets_sold;
              const isSoldOut = ticketsLeft <= 0;

              return (
                <div key={ev.id} className="editorial-sheet" style={{ 
                  padding: '2.5rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap', 
                  gap: '2rem',
                  borderLeft: ev.privacy === 'private' ? '4px solid var(--accent)' : '1px solid var(--border-color)',
                  position: 'relative'
                }}>
                  {/* Privacy Badge */}
                  <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }}>
                    <span style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '12px',
                      background: ev.privacy === 'private' ? 'var(--accent-light)' : 'var(--border-color)',
                      color: ev.privacy === 'private' ? 'var(--accent-dark)' : 'var(--text-secondary)',
                      textTransform: 'uppercase'
                    }}>
                      {ev.privacy.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ flex: '1', minWidth: '280px' }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      {ev.title}
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                      {ev.description}
                    </p>

                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Date</span>
                        {ev.date}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Venue</span>
                        {ev.venue}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Tickets Availability</span>
                        {isSoldOut ? (
                          <span style={{ color: '#e74c3c', fontWeight: 700 }}>SOLD OUT</span>
                        ) : (
                          <span>{ticketsLeft} of {ev.total_tickets} remaining</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Ticket Price</span>
                      <span style={{ fontSize: '1.6rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)' }}>
                        {ev.ticket_price > 0 ? `GH₵ ${ev.ticket_price.toFixed(2)}` : 'FREE'}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => handleBuyTickets(ev)}
                      disabled={isSoldOut}
                      className={`luxury-btn ${isSoldOut ? 'disabled' : ''}`}
                      style={{ width: '100%', padding: '0.75rem' }}
                    >
                      {isSoldOut ? 'SOLD OUT' : 'GET TICKETS'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Interactive Checkout Section */}
      {selectedEvent && (
        <div id="ticket-checkout-form" className="editorial-sheet" style={{ marginTop: '4rem', padding: '2.5rem', animation: 'fadeIn 0.4s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
              Ticket Checkout: {selectedEvent.title}
            </h2>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              type="button"
              aria-label="Cancel purchase and close checkout form"
            >
              ✕ Cancel
            </button>
          </div>

          {checkoutError && (
            <div style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1.5rem', fontWeight: 500 }}>
              {checkoutError}
            </div>
          )}

          <form onSubmit={handlePurchaseSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ama Mensah"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="luxury-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ama@gmail.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="luxury-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="024xxxxxxx"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="luxury-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  Ticket Quantity (Max 5) *
                </label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="luxury-select"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                >
                  <option value={1}>1 Ticket</option>
                  <option value={2}>2 Tickets</option>
                  <option value={3}>3 Tickets</option>
                  <option value={4}>4 Tickets</option>
                  <option value={5}>5 Tickets</option>
                </select>
              </div>

              {selectedEvent.privacy === 'private' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Private Access Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Invite Code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="luxury-input"
                    style={{ borderColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    This event is invite-only. Enter invite code (e.g. VIP2026).
                  </span>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1.25rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Subtotal
                </span>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  {quantity} x {selectedEvent.title}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Total cost
                </span>
                <p style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', marginTop: '0.15rem' }}>
                  GH₵ {(selectedEvent.ticket_price * quantity).toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="luxury-btn"
              style={{ width: '100%', padding: '1rem', fontSize: '0.8rem', letterSpacing: '0.15em' }}
            >
              {submitting ? 'PROCESSING CHECKOUT...' : 'PROCEED TO SECURE PAYMENT'}
            </button>
          </form>
        </div>
      )}

      {/* Retrieve Tickets Sync Section */}
      <div className="editorial-sheet" style={{ marginTop: '4rem', padding: '2.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', fontFamily: 'var(--font-serif)', fontWeight: 400, textAlign: 'center' }}>
          Retrieve Purchased Tickets
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center', lineHeight: '1.5' }}>
          Bought tickets on another device or cleared your cache? Enter your Email, Phone number, Ticket code, or Payment reference to restore your passes.
        </p>

        <form onSubmit={handleLookupTickets} style={{ display: 'flex', gap: '0.75rem', maxWidth: '500px', margin: '0 auto' }}>
          <input 
            type="text" 
            placeholder="ENTER EMAIL, PHONE, OR REF..." 
            value={lookupQuery} 
            onChange={(e) => setLookupQuery(e.target.value)}
            className="luxury-input"
            style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            required
          />
          <button 
            type="submit" 
            disabled={lookupLoading}
            className="luxury-btn" 
            style={{ padding: '0.6rem 1.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
          >
            {lookupLoading ? 'SEARCHING...' : 'FIND PASSES'}
          </button>
        </form>

        {lookupError && (
          <p style={{ color: '#e74c3c', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem', fontWeight: 600 }}>
            {lookupError}
          </p>
        )}

        {lookupSuccess && (
          <p style={{ color: '#27ae60', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem', fontWeight: 600 }}>
            {lookupSuccess}
          </p>
        )}
      </div>

      {/* Guest Tickets / Purchased Passes Console */}
      {purchasedTickets.length > 0 && (
        <div style={{ marginTop: '5rem', borderTop: '1px solid var(--border-color)', paddingTop: '4rem', animation: 'fadeIn 0.6s ease' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', marginBottom: '0.5rem', textAlign: 'center' }}>
            MY ACTIVE PASSES
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', textAlign: 'center' }}>
            Present these codes or QR tags at the gate for scanning and check-in.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {purchasedTickets.map((t, idx) => (
              <div key={t.id || idx} className="editorial-sheet" style={{ 
                margin: 0, 
                padding: '2rem', 
                borderLeft: '4px solid var(--accent)', 
                background: 'rgba(255, 255, 255, 0.45)', 
                backdropFilter: 'blur(20px)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span className="ref-badge" style={{ background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }}>
                      TICKET CODE
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(t.ticket_code);
                        setCopiedCode(t.ticket_code);
                        setTimeout(() => setCopiedCode(null), 2000);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.65rem',
                        textTransform: 'uppercase',
                        color: 'var(--accent-dark)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        padding: 0
                      }}
                    >
                      {copiedCode === t.ticket_code ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                  <h3 style={{ fontFamily: 'monospace', fontSize: '1.3rem', letterSpacing: '0.05em', color: 'var(--accent-dark)', fontWeight: 700, margin: '0.5rem 0' }}>
                    {t.ticket_code}
                  </h3>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.75rem', color: 'var(--text-primary)' }}>
                    {t.event_title}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {t.event_venue} <br /> {t.event_date}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  {/* Procedural Visual QR Code mockup */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: '#000',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '2px'
                  }}>
                    {/* Visual pattern representing QR blocks */}
                    {Array.from({ length: 25 }).map((_, i) => {
                      // Anchor corners
                      const isCorner = (i === 0 || i === 4 || i === 20 || i === 24);
                      const isInsideCorner = (i === 1 || i === 3 || i === 5 || i === 9 || i === 15 || i === 19 || i === 21 || i === 23);
                      const active = isCorner || (!isInsideCorner && (i * 7 + idx * 13) % 2 === 0);
                      return (
                        <div key={i} style={{
                          background: active ? 'var(--accent)' : 'transparent',
                          borderRadius: '1px'
                        }} />
                      );
                    })}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Admit: {t.quantity} Guest(s)
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Holder: {t.buyer_name}
                    </div>
                  </div>
                </div>

                {/* Gate scan status badge */}
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                  <span style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px',
                    background: t.scanned === 1 ? 'rgba(46,204,113,0.15)' : 'rgba(230,126,34,0.15)',
                    color: t.scanned === 1 ? '#2ecc71' : '#e67e22',
                    border: t.scanned === 1 ? '1px solid rgba(46,204,113,0.3)' : '1px solid rgba(230,126,34,0.3)',
                    textTransform: 'uppercase'
                  }}>
                    {t.scanned === 1 ? 'Checked In' : 'Active Pass'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
