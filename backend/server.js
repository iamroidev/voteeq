const express = require('express');
const { formatEventDateForDisplay } = require('./event-date');
const { fixAscesSpelling } = require('./acses-spelling');

function withNormalizedEventDate(row) {
  if (!row) return row;
  return { ...row, event_date: formatEventDateForDisplay(row.event_date) };
}
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { initDB, getDB, reseedACSESAwards, reseedCampusDemo, resetAllButCategories } = require('./database');
const { ACSES_AWARD_CATEGORIES } = require('./seed-acses-categories');
const {
  hashPin,
  verifyPin,
  isPendingActivation,
  verifyAdminCredentials,
  generateReference,
  generateStatusToken,
  verifyStatusToken,
  escapeHtml,
  isValidPhotoUrl,
  isValidNomineeCode,
  validateProductionConfig,
  mockPaymentsAllowed,
  timingSafeEqualStr,
  MAX_VOTES_PER_TRANSACTION,
  isProduction,
} = require('./security');
const {
  runInBackground,
  completeVotePayment,
  completeTicketPayment,
  completeRegistrationPayment,
  checkInTicket,
} = require('./payment-completion');
const { createRateLimiter } = require('./rate-limiter');
const { prepareProfilePhotoFromDataUrl, buildProfilePhotoUrl } = require('./profile-photo');
const { validateGhanaPhone, getMomoProvider } = require('./phone');
const { createRushPayPayment, createRushPayWidgetSession, verifyRushPayWebhook, verifyRushPayTransaction } = require('./rushpay');
const { sendSMS } = require('./sms');

const { generateShareCardImage, resolveShareOgImage } = require('./share-card');
const { calculatePaystackCheckout } = require('./paystack-fees');
const LEADERBOARD_LOCKED = true;
const {
  isValidEmail,
  normalizeEmail,
  sendVoteReceiptEmail,
  sendTicketReceiptEmail,
} = require('./email');
require('dotenv').config();

validateProductionConfig();

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 5000;
const server = http.createServer(app);

// WebSocket Server initialization
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || (isProduction() ? null : 'voteeq_dev_secret_key');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

function generateToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (!timingSafeEqualStr(signature, expectedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// In-memory rate limiting middleware
const rateLimiter = createRateLimiter;

// Email/SMS receipt logger
const fs = require('fs');
const path = require('path');
const receiptsLogPath = path.resolve(__dirname, 'receipts.log');

async function sendVoteReceipt(voteId, { force = false } = {}) {
  try {
    const db = getDB();
    const vote = await db.get(`
      SELECT v.*, n.name as nominee_name 
      FROM votes v 
      JOIN nominees n ON v.nominee_id = n.id 
      WHERE v.id = ?
    `, [voteId]);

    if (!vote) {
      return { ok: false, reason: 'not_found' };
    }
    if (vote.status !== 'completed') {
      return { ok: false, reason: 'not_completed' };
    }
    if (!force && vote.receipt_sent === 1) {
      return { ok: false, reason: 'already_sent' };
    }
    if (!vote.email || !isValidEmail(vote.email)) {
      return { ok: false, reason: 'no_email' };
    }

    const amountGHS = vote.amount_paid != null
      ? vote.amount_paid
      : (vote.channel === 'web' ? vote.vote_count * 1.0 : vote.vote_count * 0.5);
    const timestamp = new Date(vote.created_at || Date.now()).toLocaleString();

    let emailSent = false;
    let resendId;
    try {
      const result = await sendVoteReceiptEmail({
        to: normalizeEmail(vote.email),
        nomineeName: vote.nominee_name,
        voteCount: vote.vote_count,
        amountGHS,
        reference: vote.payment_reference,
        phone: vote.voter_phone,
      });
      if (result.sent) {
        emailSent = true;
        resendId = result.id;
        console.log(`Vote receipt emailed to ${vote.email} (Resend id: ${result.id})`);
      } else {
        console.warn(`Vote receipt not emailed: ${result.reason}`);
        return { ok: false, reason: result.reason || 'email_not_sent' };
      }
    } catch (mailErr) {
      console.error('Resend vote receipt failed:', mailErr.message);
      return { ok: false, reason: mailErr.message || 'email_failed' };
    }

    const receiptMessage = `
========================================
VOTEEQ VOTE RECEIPT${force ? ' (RESENT BY ADMIN)' : ''}
Receipt ID: REC_${vote.id}_${vote.payment_reference}
Timestamp: ${timestamp}
Nominee: ${vote.nominee_name}
Votes: ${vote.vote_count}
Amount: GHS ${amountGHS.toFixed(2)}
Reference: ${vote.payment_reference}
Email: ${vote.email || 'N/A'}
Phone: ${vote.voter_phone || 'N/A'}
========================================\n\n`;
    fs.appendFileSync(receiptsLogPath, receiptMessage, 'utf8');

    if (emailSent) {
      await db.run('UPDATE votes SET receipt_sent = 1 WHERE id = ?', [vote.id]);
      return { ok: true, email: vote.email, resendId };
    }

    return { ok: false, reason: 'email_not_sent' };
  } catch (err) {
    console.error('Error sending vote receipt:', err);
    return { ok: false, reason: err.message || 'unknown_error' };
  }
}

async function sendTicketReceipt(ticketId, { force = false } = {}) {
  try {
    const db = getDB();
    const ticket = await db.get(`
      SELECT t.*, e.title as event_title, e.venue as event_venue, e.date as event_date
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.id = ?
    `, [ticketId]);

    if (!ticket) {
      return { ok: false, reason: 'not_found' };
    }
    if (ticket.payment_status !== 'paid') {
      return { ok: false, reason: 'not_paid' };
    }

    let smsSent = false;
    let emailSent = false;
    let resendId;

    // 1. Send SMS receipt if phone is available
    if (ticket.buyer_phone) {
      const smsMessage = `Voteeq Ticket: confirmed ${ticket.quantity} ticket(s) for "${ticket.event_title}". Ticket Code: ${ticket.ticket_code}. Total Paid: GH₵ ${ticket.price_paid.toFixed(2)}. Show code at entrance.`;
      if (mockPaymentsAllowed()) {
        console.log(`[SMS MOCK] Ticket purchase receipt SMS: ${smsMessage}`);
        smsSent = true;
      } else {
        smsSent = await sendSMS(ticket.buyer_phone, smsMessage);
      }
    }

    // 2. Send Email receipt if email is valid
    if (ticket.buyer_email && isValidEmail(ticket.buyer_email) && ticket.buyer_email !== 'ussd@voteeq.online') {
      try {
        const result = await sendTicketReceiptEmail({
          to: normalizeEmail(ticket.buyer_email),
          eventTitle: ticket.event_title,
          venue: ticket.event_venue,
          date: formatEventDateForDisplay(ticket.event_date),
          buyerName: ticket.buyer_name,
          quantity: ticket.quantity,
          amountGHS: ticket.price_paid,
          ticketCode: ticket.ticket_code,
          reference: ticket.payment_reference,
        });
        if (result.sent) {
          resendId = result.id;
          emailSent = true;
          console.log(`Ticket receipt emailed to ${ticket.buyer_email} (Resend id: ${result.id})`);
        } else {
          console.warn(`Ticket receipt not emailed: ${result.reason}`);
        }
      } catch (mailErr) {
        console.error('Resend ticket receipt failed:', mailErr.message);
      }
    }

    const logMsg = `
========================================
VOTEEQ TICKET RECEIPT${force ? ' (RESENT BY ADMIN)' : ''}
Event: ${ticket.event_title}
Ticket code: ${ticket.ticket_code}
Buyer: ${ticket.buyer_name} (${ticket.buyer_email || 'No Email'}, Phone: ${ticket.buyer_phone || 'No Phone'})
Quantity: ${ticket.quantity}
Amount: GHS ${ticket.price_paid.toFixed(2)}
Reference: ${ticket.payment_reference}
SMS Sent: ${smsSent ? 'Yes' : 'No'}
========================================\n\n`;
    fs.appendFileSync(receiptsLogPath, logMsg);

    return { ok: smsSent || emailSent, email: ticket.buyer_email, smsSent, emailSent, resendId };
  } catch (err) {
    console.error('Error sending ticket receipt:', err);
    return { ok: false, reason: err.message || 'unknown_error' };
  }
}


// CORS: merge env origins with production frontends (www + apex always allowed)
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://voteeq.online',
  'https://www.voteeq.online',
  'https://voteeq.vercel.app',
  'https://voteeq-roi-dev.vercel.app',
  'https://frontend-roi-dev.vercel.app',
];
const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.replace(/\r/g, '').split(',').map((s) => s.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...new Set([...DEFAULT_CORS_ORIGINS, ...envOrigins])];

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || !isProduction()) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
})); // support large canvas uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', async (req, res) => {
  try {
    const db = getDB();
    await db.get('SELECT 1 as ok');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Ensure banners folder exists
const bannersDir = path.resolve(__dirname, 'banners');
if (!fs.existsSync(bannersDir)) {
  fs.mkdirSync(bannersDir);
}
app.use('/banners', express.static(bannersDir));

const photosDir = path.resolve(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir);
}
app.use('/photos', express.static(photosDir, {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  },
}));

function getServerUrl(req) {
  const host = req.headers.host || 'localhost:5000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function getPublicAssetBaseUrl(req) {
  const configured = process.env.PUBLIC_ASSET_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return getServerUrl(req);
}

function verifyNomineeToken(req, code) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized nominee access', status: 403 };
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'nominee') {
    return { error: 'Unauthorized nominee access', status: 403 };
  }
  if (code && payload.code !== code) {
    return { error: 'Forbidden: cannot modify another nominee', status: 403 };
  }
  return { payload };
}

async function saveNomineeProfilePhoto(req, code, image) {
  if (!isValidNomineeCode(code)) {
    const err = new Error('Invalid nominee code');
    err.status = 400;
    throw err;
  }

  const db = getDB();
  const nominee = await db.get('SELECT id FROM nominees WHERE code = ?', [code]);
  if (!nominee) {
    const err = new Error('Nominee not found');
    err.status = 404;
    throw err;
  }

  const { buffer } = await prepareProfilePhotoFromDataUrl(image);

  for (const ext of ['jpg', 'png', 'webp']) {
    const oldPath = path.resolve(photosDir, `${code}.${ext}`);
    if (oldPath.startsWith(path.resolve(photosDir)) && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const filename = path.resolve(photosDir, `${code}.jpg`);
  if (!filename.startsWith(path.resolve(photosDir))) {
    const err = new Error('Invalid photo path');
    err.status = 400;
    throw err;
  }

  fs.writeFileSync(filename, buffer);

  const version = Date.now();
  const photoUrl = buildProfilePhotoUrl(getPublicAssetBaseUrl(req), code, version);
  await db.run('UPDATE nominees SET photo_url = ? WHERE code = ?', [photoUrl, code]);
  return photoUrl;
}

// In-memory store for active USSD sessions
const ussdSessions = new Map();

// Helper: Fetch nominee by code
async function findNomineeByCode(code) {
  const db = getDB();
  return await db.get('SELECT * FROM nominees WHERE code = ?', [code]);
}

function maskPhone(phone) {
  if (!phone) return 'N/A';
  const s = String(phone);
  if (s.length <= 4) return '****';
  return '*'.repeat(Math.min(s.length - 4, 6)) + s.slice(-4);
}

function adminUsername(req) {
  return req.admin?.username || 'admin';
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

function setShortPublicCache(res) {
  res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
}

// 1. Get Categories
app.get('/api/categories', async (req, res) => {
  try {
    const db = getDB();
    const categories = await db.all('SELECT * FROM categories ORDER BY name ASC');
    setShortPublicCache(res);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching categories' });
  }
});

// 2. Get Nominees
app.get('/api/nominees', async (req, res) => {
  try {
    const db = getDB();
    const eventId = req.query.event_id ? String(req.query.event_id) : null;
    
    let query = '';
    if (LEADERBOARD_LOCKED) {
      query = `
        SELECT n.id, n.code, n.name, n.photo_url, n.category_id, n.event_id, 0 as votes_count, n.created_at, c.name as category_name 
        FROM nominees n 
        JOIN categories c ON n.category_id = c.id
        ${eventId ? 'WHERE n.event_id = ? OR n.event_id IS NULL' : ''}
        ORDER BY c.name ASC, n.code ASC
      `;
    } else {
      query = `
        SELECT n.id, n.code, n.name, n.photo_url, n.category_id, n.event_id, n.votes_count, n.created_at, c.name as category_name 
        FROM nominees n 
        JOIN categories c ON n.category_id = c.id
        ${eventId ? 'WHERE n.event_id = ? OR n.event_id IS NULL' : ''}
        ORDER BY n.votes_count DESC
      `;
    }

    const nominees = await db.all(query, eventId ? [eventId] : []);
    setShortPublicCache(res);
    res.json(nominees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching nominees' });
  }
});

// 3. Nominee Login (PIN)
app.post('/api/nominees/login', rateLimiter(15 * 60 * 1000, 10), async (req, res) => {
  const { code, passcode } = req.body;
  if (!code || !passcode) {
    return res.status(400).json({ error: 'Nominee Code and PIN are required' });
  }

  try {
    const db = getDB();
    const nominee = await db.get('SELECT * FROM nominees WHERE code = ?', [code]);
    if (!nominee) {
      return res.status(401).json({ error: 'Nominee not found' });
    }

    if (isPendingActivation(nominee.passcode)) {
      return res.status(401).json({ error: 'Account not activated. Use Register PIN from the menu.' });
    }

    const pinResult = await verifyPin(passcode, nominee.passcode);
    if (!pinResult.valid) {
      return res.status(401).json({ error: 'Invalid PIN code' });
    }
    if (pinResult.needsRehash) {
      const hashed = await hashPin(passcode);
      await db.run('UPDATE nominees SET passcode = ? WHERE code = ?', [hashed, code]);
    }

    // Secure cryptographic signature token
    const token = generateToken({
      role: 'nominee',
      code: nominee.code,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 Hours
    });

    res.json({
      success: true,
      token: token,
      nominee: {
        id: nominee.id,
        code: nominee.code,
        name: nominee.name,
        photo_url: nominee.photo_url,
        category_id: nominee.category_id,
        event_id: nominee.event_id,
        votes_count: LEADERBOARD_LOCKED ? 0 : nominee.votes_count
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Authentication error' });
  }
});

// 3a. Nominee PIN Registration / Activation
app.post('/api/nominees/register', rateLimiter(15 * 60 * 1000, 10), async (req, res) => {
  const { code, activationCode, newPin } = req.body;
  if (!code || !newPin) {
    return res.status(400).json({ error: 'Nominee Code and new PIN are required' });
  }

  // Basic validation of PIN (e.g. numerical 4-6 digits)
  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN must be a 4 to 6 digit number' });
  }

  try {
    const db = getDB();
    const nominee = await db.get('SELECT * FROM nominees WHERE code = ?', [code]);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee code not found in system' });
    }

    // Check if passcode indicates a pending activation
    const isPending = nominee.passcode === 'PENDING' || (nominee.passcode && nominee.passcode.startsWith('PENDING_ACT_'));
    if (!isPending) {
      return res.status(400).json({ error: 'Account already activated. Use Nominee Login.' });
    }

    // If it's a secure activation flow (starts with PENDING_ACT_)
    if (nominee.passcode && nominee.passcode.startsWith('PENDING_ACT_')) {
      const expectedCode = nominee.passcode.replace('PENDING_ACT_', '');
      if (!activationCode || activationCode.trim() !== expectedCode) {
        return res.status(401).json({ error: 'Invalid or missing Temporary Activation Code' });
      }
    }

    const hashedPin = await hashPin(newPin);
    await db.run('UPDATE nominees SET passcode = ? WHERE code = ?', [hashedPin, code]);

    res.json({ success: true, message: 'Account activated successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during registration' });
  }
});

// 3b. Admin Login
app.post('/api/admin/login', rateLimiter(15 * 60 * 1000, 10), async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and Password are required' });
  }

  if (verifyAdminCredentials(username, password)) {
    const token = generateToken({
      role: 'admin',
      username,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 Hours
    });
    res.json({
      success: true,
      token: token
    });
  } else {
    res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

// 1b. Get all events (access codes hidden from public)
app.get('/api/events', async (req, res) => {
  try {
    const db = getDB();
    const authHeader = req.headers.authorization;
    let isAdmin = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.split(' ')[1]);
      isAdmin = !!(payload && payload.role === 'admin');
    }
    const events = isAdmin
      ? await db.all('SELECT * FROM events ORDER BY date ASC')
      : await db.all(`
          SELECT id, title, description, date, venue, ticket_price, privacy, total_tickets, tickets_sold, created_at
          FROM events ORDER BY date ASC
        `);
    const normalizedEvents = events.map((event) => ({
      ...event,
      title: fixAscesSpelling(event.title),
      description: fixAscesSpelling(event.description),
      date: formatEventDateForDisplay(event.date),
    }));
    if (!isAdmin) {
      setShortPublicCache(res);
    }
    res.json(normalizedEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching events' });
  }
});

// 1c. Purchase event ticket (initialize payment reference)
app.post('/api/tickets/purchase', rateLimiter(5 * 60 * 1000, 25), async (req, res) => {
  if (process.env.TICKETS_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Ticket sales are not open yet.' });
  }

  const { event_id, buyer_name, buyer_email, buyer_phone, quantity, access_code } = req.body;

  if (!event_id || !buyer_name || !buyer_email || !buyer_phone || !quantity) {
    return res.status(400).json({ error: 'Missing required fields for ticket purchase' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0 || qty > 5) {
    return res.status(400).json({ error: 'Invalid quantity. A maximum of 5 tickets can be bought at once.' });
  }

  const phoneCheck = validateGhanaPhone(buyer_phone);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: phoneCheck.error });
  }

  if (!isValidEmail(buyer_email)) {
    return res.status(400).json({ error: 'A valid email is required to send your ticket receipt.' });
  }
  const normalizedBuyerEmail = normalizeEmail(buyer_email);

  const rushpayApiKey = process.env.RUSHPAY_API_KEY;
  if (isProduction() && !rushpayApiKey) {
    return res.status(503).json({ error: 'Ticket payments are not configured yet. Please try again later.' });
  }

  try {
    const db = getDB();
    await cleanupStaleTickets(db);
    const event = await db.get('SELECT * FROM events WHERE id = ?', [event_id]);
    if (!event) {
      return res.status(404).json({ error: 'Selected event not found' });
    }

    if (event.privacy === 'private') {
      if (!access_code || access_code.trim() !== event.access_code) {
        return res.status(400).json({ error: 'Invalid access code for this private event' });
      }
    }

    const ticketCode = `TIX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const ticketPricing = calculatePaystackCheckout(event.ticket_price * qty);
    const totalPrice = ticketPricing.totalDue;
    const mockRef = generateReference('tix');
    const statusToken = generateStatusToken(mockRef);

    const frontendBase = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';

    if (rushpayApiKey) {
      try {
        // 1. Create RushPay payment
        const rushpayData = await createRushPayPayment({
          amount: totalPrice,
          description: `Tickets for ${event.title} (${qty} x ticket)`,
          callbackUrl: `${frontendBase}/#/payment-status?token=${statusToken}`,
          metadata: {
            type: 'ticket',
            event_id,
            quantity: qty,
            phone: phoneCheck.normalized,
            email: normalizedBuyerEmail
          }
        });

        const paymentReference = rushpayData.payment_reference;

        // 2. Create widget session token
        const widgetSession = await createRushPayWidgetSession(paymentReference);
        const widgetSessionToken = widgetSession.widget_session_token;

        // 3. Save pending ticket using RushPay reference
        await db.transaction(async (tx) => {
          const capacity = await tx.get(
            'SELECT tickets_sold, total_tickets FROM events WHERE id = ?',
            [event_id]
          );
          if (!capacity || capacity.tickets_sold + qty > capacity.total_tickets) {
            throw new Error('SOLD_OUT');
          }
          await tx.run(`
            INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `, [event_id, ticketCode, buyer_name, normalizedBuyerEmail, phoneCheck.normalized, qty, totalPrice, paymentReference]);
        });

        return res.json({
          paymentReference,
          widgetSessionToken,
          statusToken,
          isMock: false,
          pricing: ticketPricing,
        });
      } catch (rushpayErr) {
        console.error('RushPay ticket init error:', rushpayErr);
        return res.status(400).json({ error: rushpayErr.message || 'RushPay initialization failed' });
      }
    } else {
      // Mock payment details
      await db.transaction(async (tx) => {
        const capacity = await tx.get(
          'SELECT tickets_sold, total_tickets FROM events WHERE id = ?',
          [event_id]
        );
        if (!capacity || capacity.tickets_sold + qty > capacity.total_tickets) {
          throw new Error('SOLD_OUT');
        }
        await tx.run(`
          INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [event_id, ticketCode, buyer_name, normalizedBuyerEmail, phoneCheck.normalized, qty, totalPrice, mockRef]);
      });

      return res.json({
        reference: mockRef,
        statusToken,
        authorization_url: `/mock-paystack-checkout?reference=${mockRef}&statusToken=${statusToken}&amount=${totalPrice}&event=${encodeURIComponent(event.title)}&quantity=${qty}&isTicket=true`,
        isMock: true,
        pricing: ticketPricing,
      });
    }
  } catch (err) {
    if (err.message === 'SOLD_OUT') {
      return res.status(400).json({ error: 'Ticket booking failed: Sold out or insufficient tickets remaining.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize ticket purchase' });
  }
});

// Mock Paystack Ticket Success Trigger (development only)
app.post('/api/payment/mock-verify-ticket', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
  if (!mockPaymentsAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Reference code is required' });
  }

  try {
    const db = getDB();
    const ticketRecord = await db.get('SELECT * FROM tickets WHERE payment_reference = ?', [reference]);

    if (!ticketRecord) {
      return res.status(404).json({ error: 'Ticket reference not found' });
    }

    const result = await completeTicketPayment(db, reference);

    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Ticket reference not found' });
    }

    if (result.outcome === 'completed') {
      runInBackground(() => sendTicketReceipt(result.ticket.id));
    }

    const ticketDetails = await db.get(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.payment_reference = ?
    `, [reference]);

    return res.json({
      success: true,
      message: result.outcome === 'completed'
        ? 'Ticket payment verified successfully!'
        : 'Ticket payment already processed',
      ticket: ticketDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mock ticket validation error' });
  }
});

async function logAdminAction(adminUsername, action, details) {
  try {
    const db = getDB();
    await db.run(`
      INSERT INTO admin_audit_logs (admin_username, action, details)
      VALUES (?, ?, ?)
    `, [adminUsername || 'system', action, details]);
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

async function cleanupStaleTickets(db) {
  try {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = await db.run(`
      DELETE FROM tickets 
      WHERE payment_status = 'pending' 
        AND created_at < ?
    `, [thirtyMinsAgo]);
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} stale pending ticket(s)`);
    }
  } catch (err) {
    console.error('Failed to cleanup stale pending tickets:', err);
  }
}

// Helper: Verify Admin Token Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Unauthorized admin access' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized admin access' });
  }
  req.admin = payload;
  next();
}

// 3c. Admin Overview Data
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  try {
    const db = getDB();

    const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
    const nomCount = await db.get('SELECT COUNT(*) as count FROM nominees');
    const voteStats = await db.get(`
      SELECT COUNT(*) as count, SUM(vote_count) as total_votes 
      FROM votes 
      WHERE status = 'completed'
    `);

    const channelStats = await db.all(`
      SELECT channel, SUM(vote_count) as votes 
      FROM votes 
      WHERE status = 'completed' 
      GROUP BY channel
    `);

    // Revenue calculations: Web = 1.00 GHS, USSD = 0.50 GHS
    const webVotes = channelStats.find(s => s.channel === 'web')?.votes || 0;
    const ussdVotes = channelStats.find(s => s.channel === 'ussd')?.votes || 0;
    const totalRevenue = (webVotes * 1.00) + (ussdVotes * 0.50);

    res.json({
      categoriesCount: catCount.count,
      nomineesCount: nomCount.count,
      totalVotes: voteStats.total_votes || 0,
      totalRevenue: totalRevenue,
      channelStats: {
        web: webVotes,
        ussd: ussdVotes
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching admin stats overview' });
  }
});

// 3d. Create Category
app.post('/api/admin/categories', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category Name is required' });
  }

  try {
    const db = getDB();
    await db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || '']);
    res.json({ success: true, message: 'Category created successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating category' });
  }
});

// 3e. Delete Category
app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDB();

    // Verify check: are there nominees under this category?
    const nomineeCheck = await db.get('SELECT COUNT(*) as count FROM nominees WHERE category_id = ?', [id]);
    if (nomineeCheck.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category containing active nominees' });
    }

    await db.run('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting category' });
  }
});

// 3ee. Get Nominees for Admin (includes passcodes / activation codes)
app.get('/api/admin/nominees', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const nominees = await db.all(`
      SELECT n.id, n.code, n.name, n.photo_url, n.category_id, n.event_id, n.votes_count, n.passcode, n.created_at, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      ORDER BY n.id DESC
    `);
    res.json(nominees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching admin nominees' });
  }
});

// 3f. Create Nominee
app.post('/api/admin/nominees', requireAdmin, async (req, res) => {
  const { code, name, photo_url, category_id, event_id } = req.body;
  if (!code || !name || !category_id) {
    return res.status(400).json({ error: 'Code, Name and Category are required' });
  }
  if (!isValidNomineeCode(code)) {
    return res.status(400).json({ error: 'Invalid nominee code format' });
  }

  const defaultPhoto = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
  const resolvedPhoto = photo_url?.trim() ? photo_url.trim() : defaultPhoto;
  if (!isValidPhotoUrl(resolvedPhoto)) {
    return res.status(400).json({ error: 'Photo URL must be a valid http(s) URL' });
  }

  try {
    const db = getDB();

    // Verify unique code
    const existing = await db.get('SELECT id FROM nominees WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ error: 'Nominee Code already exists in system' });
    }

    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await db.run(
      'INSERT INTO nominees (code, name, photo_url, category_id, event_id, passcode, votes_count) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [
        code,
        name,
        resolvedPhoto,
        category_id,
        event_id ? parseInt(event_id, 10) : null,
        `PENDING_ACT_${activationCode}`
      ]
    );
    await logAdminAction(adminUsername(req), 'CREATE_NOMINEE', `Created nominee: ${name} (${code})`);
    res.json({ 
      success: true, 
      message: 'Nominee added in PENDING activation state. Save the activation code now — it will not be shown again.',
      activationCode: activationCode
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error adding nominee' });
  }
});

// 3g. Delete Nominee
app.delete('/api/admin/nominees/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDB();

    // Clean up associated votes
    await db.run('DELETE FROM votes WHERE nominee_id = ?', [id]);
    await db.run('DELETE FROM nominees WHERE id = ?', [id]);

    res.json({ success: true, message: 'Nominee deleted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting nominee' });
  }
});

// 3h. Admin upload nominee profile photo
app.post('/api/admin/nominees/:code/upload-photo', requireAdmin, async (req, res) => {
  const { code } = req.params;
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    const photoUrl = await saveNomineeProfilePhoto(req, code, image);
    await logAdminAction(adminUsername(req), 'UPLOAD_NOMINEE_PHOTO', `Uploaded profile photo for nominee ${code}`);
    console.log(`Admin uploaded profile photo for nominee ${code}`);
    res.json({ success: true, photo_url: photoUrl, message: 'Profile photo updated successfully!' });
  } catch (err) {
    console.error('Admin upload photo error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save profile photo' });
  }
});


// 4. Nominee Dashboard Data
app.get('/api/nominees/dashboard/:code', async (req, res) => {
  const { code } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Unauthorized dashboard access' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'nominee' || payload.code !== code) {
    return res.status(403).json({ error: 'Unauthorized dashboard access' });
  }

  try {
    const db = getDB();
    const nominee = await db.get(`
      SELECT n.*, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      WHERE n.code = ?
    `, [code]);

    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    // Get recent votes (masked phone numbers)
    const rawVotes = await db.all(`
      SELECT id, voter_phone, vote_count, channel, status, created_at
      FROM votes
      WHERE nominee_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [nominee.id]);
    const votes = rawVotes.map(v => ({ ...v, voter_phone: maskPhone(v.voter_phone) }));

    const { passcode, ...safeNominee } = nominee;

    // Sum vote methods
    const channelStats = await db.all(`
      SELECT channel, SUM(vote_count) as total
      FROM votes
      WHERE nominee_id = ? AND status = 'completed'
      GROUP BY channel
    `, [nominee.id]);

    const hasCustomBanner = fs.existsSync(path.join(bannersDir, `${code}.png`));

    res.json({
      nominee: safeNominee,
      recentVotes: votes,
      hasCustomBanner,
      channelStats: {
        web: channelStats.find(s => s.channel === 'web')?.total || 0,
        ussd: channelStats.find(s => s.channel === 'ussd')?.total || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading dashboard metrics' });
  }
});

// 4a. Nominee upload profile photo (from phone gallery / camera)
app.post('/api/nominees/upload-photo', async (req, res) => {
  const { code, image } = req.body;
  if (!code || !image) {
    return res.status(400).json({ error: 'Code and image data are required' });
  }

  const auth = verifyNomineeToken(req, code);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  if (!isValidNomineeCode(code)) {
    return res.status(400).json({ error: 'Invalid nominee code' });
  }

  try {
    const photoUrl = await saveNomineeProfilePhoto(req, code, image);
    console.log(`Profile photo saved for nominee ${code}`);
    res.json({ success: true, photo_url: photoUrl, message: 'Profile photo updated successfully!' });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to save profile photo' });
  }
});

// 4aa. Nominee change passcode/PIN
app.post('/api/nominees/change-pin', async (req, res) => {
  const { code, oldPin, newPin } = req.body;
  if (!code || !oldPin || !newPin) {
    return res.status(400).json({ error: 'Code, current PIN, and new PIN are required' });
  }

  const auth = verifyNomineeToken(req, code);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  // Basic validation of PIN (e.g. numerical 4-6 digits)
  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ error: 'New PIN must be a 4 to 6 digit number' });
  }

  try {
    const db = getDB();
    const nominee = await db.get('SELECT * FROM nominees WHERE code = ?', [code]);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    const pinResult = await verifyPin(oldPin, nominee.passcode);
    if (!pinResult.valid) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    const hashedPin = await hashPin(newPin);
    await db.run('UPDATE nominees SET passcode = ? WHERE code = ?', [hashedPin, code]);

    res.json({ success: true, message: 'PIN updated successfully!' });
  } catch (err) {
    console.error('Change PIN error:', err);
    res.status(500).json({ error: 'Failed to update PIN' });
  }
});

// 4b. Nominee save customized campaign poster banner to server
app.post('/api/nominees/save-banner', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Unauthorized nominee access' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'nominee') {
    return res.status(403).json({ error: 'Unauthorized nominee access' });
  }

  const { code, image } = req.body;
  if (!code || !image) {
    return res.status(400).json({ error: 'Code and image data are required' });
  }

  if (payload.code !== code) {
    return res.status(403).json({ error: 'Forbidden: cannot set banner for another nominee' });
  }

  if (!isValidNomineeCode(code)) {
    return res.status(400).json({ error: 'Invalid nominee code' });
  }

  try {
    const base64Data = image.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Banner image must be under 10MB' });
    }
    if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50) {
      return res.status(400).json({ error: 'Banner must be a valid PNG image' });
    }
    const filename = path.resolve(bannersDir, `${code}.png`);
    if (!filename.startsWith(path.resolve(bannersDir))) {
      return res.status(400).json({ error: 'Invalid banner path' });
    }
    fs.writeFileSync(filename, buffer);
    console.log(`Custom banner saved for nominee ${code} to ${filename}`);
    res.json({ success: true, message: 'Share card banner saved successfully!' });
  } catch (err) {
    console.error('Save banner error:', err);
    res.status(500).json({ error: 'Failed to save campaign banner on server' });
  }
});

// 4b. Dynamic share card (JPEG for social crawlers — SVG/remote URLs are unreliable in OG tags)
app.get('/api/nominees/share-card/:code.jpg', async (req, res) => {
  const { code } = req.params;
  try {
    const db = getDB();
    const nominee = await db.get(`
      SELECT n.*, c.name as category_name
      FROM nominees n
      JOIN categories c ON n.category_id = c.id
      WHERE n.code = ?
    `, [code]);

    if (!nominee) {
      return res.status(404).send('Nominee not found');
    }

    const image = await generateShareCardImage(nominee, { photosDir, format: 'jpeg' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(image);
  } catch (err) {
    console.error('Share card JPEG error:', err);
    res.status(500).send('Error generating share card');
  }
});

// Legacy SVG share image (kept for direct image links)
app.get('/api/nominees/share-image/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const db = getDB();
    const nominee = await db.get(`
      SELECT n.*, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      WHERE n.code = ?
    `, [code]);

    if (!nominee) {
      return res.status(404).send('Nominee not found');
    }

    const cleanName = nominee.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cleanCategory = nominee.category_name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const photo = nominee.photo_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&amp;q=80';
    const cleanPhoto = photo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e0c0a" />
      <stop offset="100%" stop-color="#241e18" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dfc49f" />
      <stop offset="50%" stop-color="#b8986c" />
      <stop offset="100%" stop-color="#8e714b" />
    </linearGradient>
    <clipPath id="portraitClip">
      <rect x="50" y="50" width="450" height="530" rx="12" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect x="15" y="15" width="1170" height="600" fill="none" stroke="url(#goldGrad)" stroke-width="2" opacity="0.4" rx="16" />

  <!-- Nominee Image with Clip Path -->
  <g transform="translate(10, 0)">
    <!-- Gold Border Ring around Portrait -->
    <rect x="47" y="47" width="456" height="536" rx="16" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
    <image href="${cleanPhoto}" x="50" y="50" width="450" height="530" clip-path="url(#portraitClip)" preserveAspectRatio="xMidYMid slice" />
  </g>

  <!-- Typography Content Area (Right Side) -->
  <g transform="translate(560, 0)">
    <!-- Category Tag Ribbon -->
    <rect x="0" y="80" width="480" height="36" rx="6" fill="#1c1814" stroke="url(#goldGrad)" stroke-width="1" />
    <text x="20" y="104" font-family="'Inter', sans-serif" font-size="14" font-weight="800" fill="#b8986c" letter-spacing="3">OFFICIAL NOMINEE PROFILE</text>

    <!-- Nominee Name -->
    <text x="0" y="200" font-family="'Playfair Display', serif" font-size="56" font-weight="bold" fill="#ffffff">${cleanName.toUpperCase()}</text>
    
    <!-- Category Title -->
    <text x="0" y="260" font-family="'Inter', sans-serif" font-size="14" font-weight="700" fill="#8c8273" letter-spacing="2">CATEGORY</text>
    <text x="0" y="300" font-family="'Playfair Display', serif" font-size="32" font-weight="500" fill="#dfc49f">${cleanCategory.toUpperCase()}</text>

    <!-- Divider -->
    <line x1="0" y1="340" x2="550" y2="340" stroke="#b8986c" stroke-width="1" opacity="0.2" />

    <!-- USSD Dialer / Instruction Card -->
    <rect x="0" y="380" width="550" height="170" rx="12" fill="#14110e" stroke="url(#goldGrad)" stroke-width="1.5" />
    <text x="30" y="425" font-family="'Inter', sans-serif" font-size="16" font-weight="bold" fill="#b8986c" letter-spacing="2">HOW TO VOTE FOR ME</text>
    <text x="30" y="470" font-family="'Inter', sans-serif" font-size="14" fill="#8c8273">Vote online and search with candidate code:</text>
    <text x="30" y="522" font-family="'Courier New', monospace" font-size="38" font-weight="bold" fill="#ffffff" letter-spacing="1">CODE: ${nominee.code}</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error('Error generating SVG:', err);
    res.status(500).send('Error generating share banner');
  }
});

// 4c. Crawl social metadata preview page (OG headers) & redirect real clients
app.get('/share/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const db = getDB();
    const nominee = await db.get(`
      SELECT n.*, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      WHERE n.code = ?
    `, [code]);

    if (!nominee) {
      return res.status(404).send('Nominee not found');
    }

    const host = req.headers.host || 'localhost:5000';
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const serverUrl = `${protocol}://${host}`;
    const { url: bannerUrl, type: bannerType } = resolveShareOgImage({
      nominee,
      code,
      serverUrl,
      bannersDir,
      photosDir,
    });

    const frontendUrl = process.env.FRONTEND_URL || (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : 'http://localhost:5173');
    const safeName = escapeHtml(nominee.name);
    const safeCategory = escapeHtml(nominee.category_name);
    const safeCode = escapeHtml(nominee.code);
    const safeBannerUrl = escapeHtml(bannerUrl);
    const safeFrontendUrl = escapeHtml(frontendUrl);
    const sharePageUrl = `${serverUrl}/share/${safeCode}`;
    const nomineeUrl = `${safeFrontendUrl}/?nominee=${safeCode}`;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vote for ${safeName} - Voteeq Awards</title>
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${sharePageUrl}">
  <meta property="og:title" content="Vote for ${safeName} - Voteeq Awards">
  <meta property="og:description" content="Support ${safeName} in the ${safeCategory} category. Vote online at voteeq.online using candidate code ${safeCode}!">
  <meta property="og:image" content="${safeBannerUrl}">
  <meta property="og:image:type" content="${bannerType}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${sharePageUrl}">
  <meta name="twitter:title" content="Vote for ${safeName} - Voteeq Awards">
  <meta name="twitter:description" content="Support ${safeName} in the ${safeCategory} category. Vote online at voteeq.online using candidate code ${safeCode}!">
  <meta name="twitter:image" content="${safeBannerUrl}">

  <!-- Redirect to the React App -->
  <meta http-equiv="refresh" content="0;url=${nomineeUrl}">
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; padding: 4rem;">
    <h2>Redirecting to voting portal...</h2>
    <p>If you are not redirected, <a href="${nomineeUrl}">click here</a>.</p>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('Share link error:', err);
    res.status(500).send('Error rendering share card');
  }
});

// 5. Initialize RushPay Payment / Vote Purchase
app.post('/api/payment/initialize', rateLimiter(1 * 60 * 1000, 10), async (req, res) => {
  const { nomineeId, email, phone, voteCount } = req.body;

  const parsedVoteCount = parseInt(voteCount, 10);
  if (!nomineeId || isNaN(parsedVoteCount) || parsedVoteCount <= 0 || parsedVoteCount > MAX_VOTES_PER_TRANSACTION) {
    return res.status(400).json({ error: `Invalid nomination id or vote count (max ${MAX_VOTES_PER_TRANSACTION})` });
  }

  const amountPerVote = 1; // 1 GHS per vote
  const pricing = calculatePaystackCheckout(amountPerVote * parsedVoteCount);

  const mockRef = generateReference('v');
  const statusToken = generateStatusToken(mockRef);
  const rushpayApiKey = process.env.RUSHPAY_API_KEY;

  if (isProduction() && !rushpayApiKey) {
    return res.status(503).json({ error: 'Vote payments are not configured yet. Please try again later.' });
  }

  const phoneCheck = validateGhanaPhone(phone);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: phoneCheck.error });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  const normalizedEmail = normalizeEmail(email);

  try {
    const db = getDB();
    const nominee = await db.get('SELECT * FROM nominees WHERE id = ?', [nomineeId]);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    if (rushpayApiKey) {
      try {
        const frontendBase = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
        
        // 1. Create RushPay payment
        const rushpayData = await createRushPayPayment({
          amount: pricing.totalDue,
          description: `Votes for ${nominee.name} (${parsedVoteCount} votes)`,
          callbackUrl: `${frontendBase}/#/payment-status?token=${statusToken}`,
          metadata: {
            type: 'vote',
            nomineeId,
            voteCount: parsedVoteCount,
            phone: phoneCheck.normalized,
            email: normalizedEmail
          }
        });

        const paymentReference = rushpayData.payment_reference;

        // 2. Create widget session token
        const widgetSession = await createRushPayWidgetSession(paymentReference);
        const widgetSessionToken = widgetSession.widget_session_token;

        // 3. Save pending vote using RushPay reference
        await db.run(`
          INSERT INTO votes (nominee_id, voter_phone, email, vote_count, channel, payment_reference, status, amount_base, amount_fee, amount_paid)
          VALUES (?, ?, ?, ?, 'web', ?, 'pending', ?, ?, ?)
        `, [
          nomineeId,
          phoneCheck.normalized,
          normalizedEmail,
          parsedVoteCount,
          paymentReference,
          pricing.baseAmount,
          pricing.processingFee,
          pricing.totalDue,
        ]);

        return res.json({
          paymentReference,
          widgetSessionToken,
          statusToken,
          isMock: false,
          pricing,
          amount: pricing.totalDue,
          votes: parsedVoteCount,
          nominee: nominee.name,
        });
      } catch (rushpayErr) {
        console.error('RushPay vote init error:', rushpayErr);
        return res.status(400).json({ error: rushpayErr.message || 'RushPay initialization failed' });
      }
    } else {
      // Offline/Development Mock flow
      await db.run(`
        INSERT INTO votes (nominee_id, voter_phone, email, vote_count, channel, payment_reference, status, amount_base, amount_fee, amount_paid)
        VALUES (?, ?, ?, ?, 'web', ?, 'pending', ?, ?, ?)
      `, [
        nomineeId,
        phoneCheck.normalized,
        normalizedEmail,
        parsedVoteCount,
        mockRef,
        pricing.baseAmount,
        pricing.processingFee,
        pricing.totalDue,
      ]);

      res.json({
        reference: mockRef,
        statusToken,
        authorization_url: `/mock-paystack-checkout?reference=${mockRef}&statusToken=${statusToken}&amount=${pricing.totalDue}&nominee=${encodeURIComponent(nominee.name)}&votes=${parsedVoteCount}`,
        isMock: true,
        pricing,
        amount: pricing.totalDue,
        votes: parsedVoteCount,
        nominee: nominee.name,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initiate checkout transaction' });
  }
});

// 6. RushPay Webhook (Verify/Complete Payment)
app.post('/api/payment/webhook', rateLimiter(1 * 60 * 1000, 100), async (req, res) => {
  const signature = req.headers['x-rushpay-signature'] || req.headers['x-signature'];
  const rushpayApiKey = process.env.RUSHPAY_API_KEY;

  if (isProduction()) {
    if (!signature) {
      return res.status(401).send('Missing RushPay signature header');
    }
    if (!verifyRushPayWebhook(req, signature)) {
      console.warn('Invalid webhook signature attempt');
      return res.status(401).send('Invalid signature');
    }
  }

  const event = req.body;
  if (!event || !event.event) {
    return res.status(400).send('Invalid webhook payload');
  }

  // Handle payment.completed
  if (event.event === 'payment.completed') {
    const data = event.data;
    const reference = data.payment_reference;

    if (!reference) {
      return res.status(400).send('Missing payment reference');
    }

    try {
      const db = getDB();

      // 1. Check if reference belongs to a vote transaction
      const voteRow = await db.get('SELECT id FROM votes WHERE payment_reference = ?', [reference]);
      if (voteRow) {
        const voteResult = await completeVotePayment(db, reference);
        if (voteResult.outcome === 'completed') {
          console.log(`Payment confirmed! Added ${voteResult.votesAdded} votes for nominee ID ${voteResult.nomineeId}`);
          runInBackground(() => sendVoteReceipt(voteResult.vote.id));
          broadcast({
            type: 'VOTE_COMPLETED',
            nomineeId: voteResult.nomineeId,
            votesCount: voteResult.votesAdded,
          });
        }
        return res.status(200).send('Webhook processed successfully');
      }

      // 2. Check if reference belongs to a ticket purchase
      const ticketRow = await db.get('SELECT id FROM tickets WHERE payment_reference = ?', [reference]);
      if (ticketRow) {
        const result = await completeTicketPayment(db, reference);
        if (result.outcome === 'completed') {
          console.log(`Ticket payment confirmed for reference: ${reference}`);
          runInBackground(() => sendTicketReceipt(result.ticket.id));
        }
        return res.status(200).send('Webhook processed successfully');
      }

      // 3. Check if reference belongs to a nominee registration form
      const regRow = await db.get('SELECT id FROM nominee_registrations WHERE payment_reference = ?', [reference]);
      if (regRow) {
        const result = await completeRegistrationPayment(db, reference);
        if (result.outcome === 'completed') {
          console.log(`Registration Form payment confirmed for reference: ${reference}`);
        }
        return res.status(200).send('Webhook processed successfully');
      }

      console.warn(`Unmatched transaction reference in webhook: ${reference}`);
      res.status(404).send('Reference not found');
    } catch (err) {
      console.error('Webhook DB Error:', err);
      res.status(500).send('Database error inside webhook handler');
    }
  } else {
    res.status(200).send('Unhandled event type');
  }
});

// Mock Paystack Payment Success Trigger (development only)
app.post('/api/payment/mock-verify', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
  if (!mockPaymentsAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Reference code is required' });
  }

  try {
    const db = getDB();
    const voteResult = await completeVotePayment(db, reference);

    if (voteResult.outcome === 'not_found') {
      return res.status(404).json({ error: 'Transaction reference not found' });
    }

    if (voteResult.outcome === 'completed') {
      runInBackground(() => sendVoteReceipt(voteResult.vote.id));
      broadcast({
        type: 'VOTE_COMPLETED',
        nomineeId: voteResult.nomineeId,
        votesCount: voteResult.votesAdded,
      });
      return res.json({ success: true, message: 'Mock payment verified successfully!' });
    }

    return res.json({ success: true, message: 'Transaction already processed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mock validation error' });
  }
});

// Mock Paystack Registration Form Success Trigger (development only)
app.post('/api/payment/mock-verify-registration', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
  if (!mockPaymentsAllowed()) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Reference code is required' });
  }

  try {
    const db = getDB();
    const regRecord = await db.get('SELECT * FROM nominee_registrations WHERE payment_reference = ?', [reference]);

    if (!regRecord) {
      return res.status(404).json({ error: 'Registration reference not found' });
    }

    if (regRecord.payment_status === 'pending') {
      await db.run("UPDATE nominee_registrations SET payment_status = 'completed' WHERE id = ?", [regRecord.id]);
      return res.json({ success: true, message: 'Form payment verified successfully!' });
    } else {
      return res.json({ success: true, message: 'Registration payment already processed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mock registration validation error' });
  }
});

// Nominee Self-Service Application
app.post('/api/nominees/apply', rateLimiter(15 * 60 * 1000, 5), async (req, res) => {
  const { name, email, phone, bio, photo_url, category_id, custom_category } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, Email and Phone are required' });
  }

  const phoneCheck = validateGhanaPhone(phone);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: phoneCheck.error });
  }

  const defaultPhoto = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
  const resolvedPhoto = photo_url || defaultPhoto;
  if (!isValidPhotoUrl(resolvedPhoto)) {
    return res.status(400).json({ error: 'Photo URL must be a valid http(s) URL' });
  }

  const formFee = 10.00;
  const mockRef = generateReference('reg');
  const statusToken = generateStatusToken(mockRef);
  const rushpayApiKey = process.env.RUSHPAY_API_KEY;

  if (isProduction() && !rushpayApiKey) {
    return res.status(503).json({ error: 'Registration payments are not configured yet. Please try again later.' });
  }

  try {
    const db = getDB();
    const frontendBase = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';

    if (rushpayApiKey) {
      try {
        // 1. Create RushPay payment
        const rushpayData = await createRushPayPayment({
          amount: formFee,
          description: `Nominee Application: ${name}`,
          callbackUrl: `${frontendBase}/#/payment-status?token=${statusToken}`,
          metadata: {
            type: 'nominee_form',
            name,
            phone: phoneCheck.normalized,
            email
          }
        });

        const paymentReference = rushpayData.payment_reference;

        // 2. Create widget session token
        const widgetSession = await createRushPayWidgetSession(paymentReference);
        const widgetSessionToken = widgetSession.widget_session_token;

        // 3. Save pending application using RushPay reference
        await db.run(`
          INSERT INTO nominee_registrations (name, email, phone, photo_url, category_id, custom_category, bio, payment_reference, payment_status, form_fee, approval_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending')
        `, [
          name, 
          email, 
          phoneCheck.normalized, 
          resolvedPhoto,
          category_id ? parseInt(category_id) : null,
          custom_category || null,
          bio || '',
          paymentReference,
          formFee
        ]);

        return res.json({
          paymentReference,
          widgetSessionToken,
          statusToken,
          isMock: false,
        });
      } catch (rushpayErr) {
        console.error('RushPay form init error:', rushpayErr);
        return res.status(400).json({ error: rushpayErr.message || 'Form purchase failed to initialize' });
      }
    } else {
      await db.run(`
        INSERT INTO nominee_registrations (name, email, phone, photo_url, category_id, custom_category, bio, payment_reference, payment_status, form_fee, approval_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending')
      `, [
        name, 
        email, 
        phoneCheck.normalized, 
        resolvedPhoto,
        category_id ? parseInt(category_id) : null,
        custom_category || null,
        bio || '',
        mockRef,
        formFee
      ]);

      res.json({
        reference: mockRef,
        statusToken,
        authorization_url: `/mock-paystack-checkout?reference=${mockRef}&statusToken=${statusToken}&amount=${formFee}&nominee=${encodeURIComponent('Nominee Form Purchase: ' + name)}&votes=1&isForm=true`,
        isMock: true
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize nominee form purchase' });
  }
});

// Admin overview of nominee registrations
app.get('/api/admin/registrations', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const registrations = await db.all(`
      SELECT r.id, r.name, r.email, r.phone, r.photo_url, r.category_id, r.custom_category, r.bio,
             r.payment_reference, r.payment_status, r.form_fee, r.approval_status, r.nominee_code, r.created_at,
             c.name as category_name
      FROM nominee_registrations r
      LEFT JOIN categories c ON r.category_id = c.id
      ORDER BY r.created_at DESC
    `);
    res.json(registrations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch nominee registrations list' });
  }
});

// Admin Approve registration
app.post('/api/admin/registrations/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDB();
    const reg = await db.get('SELECT * FROM nominee_registrations WHERE id = ?', [id]);
    if (!reg) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (reg.payment_status !== 'completed') {
      return res.status(400).json({ error: 'Form fee payment is not completed yet' });
    }

    if (reg.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Registration is already processed' });
    }

    // Assign nominee category
    let finalCategoryId = reg.category_id;
    if (!finalCategoryId && reg.custom_category) {
      // Create custom category automatically if requested and approved
      const customCatName = reg.custom_category.trim();
      let existingCat = await db.get('SELECT id FROM categories WHERE name = ?', [customCatName]);
      if (!existingCat) {
        const createResult = await db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [customCatName, 'Approved Custom Category']);
        finalCategoryId = createResult.lastID;
      } else {
        finalCategoryId = existingCat.id;
      }
    }

    if (!finalCategoryId) {
      return res.status(400).json({ error: 'Category selection or request is missing' });
    }

    // Generate unique nominee code using category list index and sequence number
    const categoryRecord = await db.get('SELECT name FROM categories WHERE id = ?', [finalCategoryId]);
    const categoryName = categoryRecord?.name || '';
    const listIndex = ACSES_AWARD_CATEGORIES.findIndex(cat => (Array.isArray(cat) ? cat[0] : cat) === categoryName);
    const prefix = listIndex !== -1 ? (listIndex + 1) : finalCategoryId;

    let assignedCode = '';
    let nomineeSeq = 1;
    while (true) {
      const seqStr = nomineeSeq.toString().padStart(2, '0');
      const candidateCode = `${prefix}${seqStr}`;
      const duplicate = await db.get('SELECT id FROM nominees WHERE code = ?', [candidateCode]);
      if (!duplicate) {
        assignedCode = candidateCode;
        break;
      }
      nomineeSeq += 1;
    }

    // Generate 6-digit random Temporary PIN
    const tempPin = Math.floor(100000 + Math.random() * 900000).toString();

    // Create nominee in database in pending state
    await db.run(`
      INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count)
      VALUES (?, ?, ?, ?, ?, 0)
    `, [
      assignedCode,
      reg.name,
      reg.photo_url,
      finalCategoryId,
      `PENDING_ACT_${tempPin}`
    ]);

    // Update registration status
    await db.run(`
      UPDATE nominee_registrations 
      SET approval_status = 'approved', nominee_code = ?, activation_pin = ?
      WHERE id = ?
    `, [assignedCode, tempPin, id]);

    await logAdminAction(adminUsername(req), 'APPROVE_REGISTRATION', `Approved registration ID: ${id}, Nominee Name: ${reg.name}, Assigned Code: ${assignedCode}`);

    // Simulate SMS notification receipt log
    const timestamp = new Date().toLocaleString();
    const activationMessage = `
========================================
VOTEEQ ONBOARDING COMMITTEE ACTIVATION
========================================
Approved Date: ${timestamp}
Registration ID: REG_${reg.id}_${reg.payment_reference}
Nominee Name: ${reg.name.toUpperCase()}
Category Assigned ID: ${finalCategoryId}
----------------------------------------
Congratulations! Your nomination interest has been approved.
Your assigned details are:
Nominee Code: ${assignedCode}
Temporary PIN: ${tempPin}

Please visit the voting portal, select "Register PIN" from the Menu, 
and input your Nominee Code and Temporary PIN to set up your personal login PIN.
========================================\n\n`;

    fs.appendFileSync(receiptsLogPath, activationMessage, 'utf8');
    console.log(`Nominee onboarding approved! Activation letter printed to receipts.log for Nominee Code: ${assignedCode}`);

    const smsText = `Voteeq: Congratulations ${reg.name.toUpperCase()}! Your nomination interest has been approved. Code: ${assignedCode}, Temp PIN: ${tempPin}. Activate at https://www.voteeq.online/#/nominee`;
    if (mockPaymentsAllowed()) {
      console.log(`[SMS MOCK] Not sending real SMS in development/sandbox. Message: ${smsText}`);
    } else {
      runInBackground(() => sendSMS(reg.phone, smsText));
    }

    res.json({ 
      success: true, 
      message: 'Onboarding approved. Nominee must activate using their assigned code and the PIN delivered via SMS.',
      assignedCode
    });


  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve nominee registration' });
  }
});

// Admin Reject registration
app.post('/api/admin/registrations/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDB();
    const reg = await db.get('SELECT id, approval_status FROM nominee_registrations WHERE id = ?', [id]);
    if (!reg) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (reg.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Registration is already processed' });
    }

    await db.run("UPDATE nominee_registrations SET approval_status = 'rejected' WHERE id = ?", [id]);
    await logAdminAction(adminUsername(req), 'REJECT_REGISTRATION', `Rejected registration ID: ${id}`);
    res.json({ success: true, message: 'Nominee registration rejected.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// 3k. Get all tickets purchased
app.get('/api/admin/tickets', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const tickets = await db.all(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
      FROM tickets t 
      JOIN events e ON t.event_id = e.id 
      ORDER BY t.created_at DESC
    `);
    res.json(tickets.map(withNormalizedEventDate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load tickets logs' });
  }
});

// 3l. Scan / Validate a ticket
app.post('/api/admin/tickets/scan', requireAdmin, async (req, res) => {
  const { ticket_code } = req.body;
  if (!ticket_code) {
    return res.status(400).json({ error: 'Ticket code is required' });
  }

  try {
    const db = getDB();
    const result = await checkInTicket(db, ticket_code);

    if (result.outcome === 'invalid_code') {
      return res.status(400).json({ error: 'Ticket code is required' });
    }
    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Ticket code is invalid or not found in system database' });
    }
    if (result.outcome === 'unpaid') {
      return res.status(400).json({
        error: `Ticket status is ${result.ticket.payment_status.toUpperCase()}. Complete payment first.`,
      });
    }
    if (result.outcome === 'already_scanned') {
      return res.status(400).json({
        error: `ACCESS DENIED: Ticket has already been checked in! Checked in at: ${new Date(result.ticket.scanned_at).toLocaleString()}`,
      });
    }

    await logAdminAction(
      adminUsername(req),
      'SCAN_TICKET',
      `Scanned ticket code: ${ticket_code.trim()}, Event: ${result.ticket.event_title}, Buyer: ${result.ticket.buyer_name}`
    );

    res.json({
      success: true,
      message: 'ACCESS GRANTED - Check-in successful',
      ticket: result.ticket,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in validation error occurred' });
  }
});

function receiptErrorMessage(reason) {
  const messages = {
    not_found: 'Transaction not found.',
    not_completed: 'Vote payment is not completed yet.',
    not_paid: 'Ticket payment is not completed yet.',
    already_sent: 'Receipt was already emailed. Use resend to send again.',
    no_email: 'No valid email address is stored for this transaction.',
    email_not_sent: 'Email could not be sent. Check Resend configuration.',
    email_failed: 'Email provider returned an error.',
  };
  return messages[reason] || String(reason || 'Could not send receipt.');
}

// Search completed vote/ticket payments for receipt support
app.get('/api/admin/receipts/search', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 3) {
    return res.status(400).json({ error: 'Enter at least 3 characters (payment reference or email).' });
  }

  try {
    const db = getDB();
    const emailQuery = normalizeEmail(q);
    const likeQuery = `%${q}%`;

    const votes = await db.all(`
      SELECT v.id, v.payment_reference, v.email, v.voter_phone, v.vote_count, v.status,
             v.receipt_sent, v.created_at, v.amount_paid, n.name as nominee_name
      FROM votes v
      JOIN nominees n ON v.nominee_id = n.id
      WHERE v.status = 'completed' AND (
        v.payment_reference = ?
        OR LOWER(v.email) = LOWER(?)
        OR v.voter_phone LIKE ?
      )
      ORDER BY v.created_at DESC
      LIMIT 25
    `, [q, emailQuery, likeQuery]);

    const tickets = await db.all(`
      SELECT t.id, t.payment_reference, t.ticket_code, t.buyer_email, t.buyer_phone,
             t.buyer_name, t.quantity, t.payment_status, t.price_paid, t.created_at,
             e.title as event_title
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.payment_status = 'paid' AND (
        t.payment_reference = ?
        OR t.ticket_code = ?
        OR LOWER(t.buyer_email) = LOWER(?)
        OR t.buyer_phone LIKE ?
      )
      ORDER BY t.created_at DESC
      LIMIT 25
    `, [q, q, emailQuery, likeQuery]);

    res.json({ votes, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Receipt search failed' });
  }
});

app.post('/api/admin/receipts/votes/:id/resend', requireAdmin, async (req, res) => {
  const voteId = parseInt(req.params.id, 10);
  if (!voteId) {
    return res.status(400).json({ error: 'Invalid vote id' });
  }

  try {
    const result = await sendVoteReceipt(voteId, { force: true });
    if (!result.ok) {
      return res.status(400).json({ error: receiptErrorMessage(result.reason) });
    }

    await logAdminAction(
      adminUsername(req),
      'RESEND_VOTE_RECEIPT',
      `Resent vote receipt for vote #${voteId} to ${result.email}`
    );

    res.json({
      success: true,
      message: `Vote receipt sent to ${result.email}.`,
      email: result.email,
      resendId: result.resendId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resend vote receipt' });
  }
});

app.post('/api/admin/receipts/tickets/:id/resend', requireAdmin, async (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  if (!ticketId) {
    return res.status(400).json({ error: 'Invalid ticket id' });
  }

  try {
    const result = await sendTicketReceipt(ticketId, { force: true });
    if (!result.ok) {
      return res.status(400).json({ error: receiptErrorMessage(result.reason) });
    }

    await logAdminAction(
      adminUsername(req),
      'RESEND_TICKET_RECEIPT',
      `Resent ticket receipt for ticket #${ticketId} to ${result.email}`
    );

    res.json({
      success: true,
      message: `Ticket receipt sent to ${result.email}.`,
      email: result.email,
      resendId: result.resendId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resend ticket receipt' });
  }
});

// ----------------------------------------------------
// USSD GATEWAY WEBHOOK (Arkesel / Hubtel style)
// ----------------------------------------------------
/**
 * Arkesel sends a POST request with:
 * {
 *   "sessionID": "12345678",
 *   "userID": "233543210987",
 *   "msisdn": "233543210987",
 *   "newSession": "1", // "1" for new, "0" for response
 *   "userData": "*SHORTCODE#", // dial string or user entry
 *   "network": "MTN"
 * }
 * 
 * Response expected is PLAINTEXT or JSON content-type.
 * For Arkesel, it expects:
 * {
 *    "action": "prompt" or "release",
 *    "message": "Text display content"
 * }
 */
app.post('/api/ussd', rateLimiter(1 * 60 * 1000, 60), async (req, res) => {
  const { sessionID, msisdn, newSession, userData } = req.body;

  if (!sessionID || !msisdn) {
    return res.status(400).json({ error: 'Missing sessionID or msisdn' });
  }

  const phone = msisdn;
  const input = userData ? userData.trim() : '';

  try {
    // If it's a completely new session
    if (newSession === '1' || newSession === 1 || !ussdSessions.has(sessionID)) {
      // Parse initial dial code: *SHORTCODE# or *SHORTCODE*CODE#
      const cleanDial = input.replace(/#/g, '');
      const parts = cleanDial.split('*'); // ["", "SHORTCODE", "566", "101"] or similar

      // Direct nominee vote shortcut: e.g. *SHORTCODE*101#
      if (parts.length >= 4) {
        const nomineeCode = parts[3];
        const nominee = await findNomineeByCode(nomineeCode);

        if (!nominee) {
          return res.json({
            action: 'release',
            message: `Nominee not found for code ${nomineeCode}. Please dial shortcode menu again.`
          });
        }

        ussdSessions.set(sessionID, {
          state: 'AWAITING_VOTES',
          nomineeId: nominee.id,
          nomineeName: nominee.name,
          nomineeCode: nominee.code,
          phone
        });

        return res.json({
          action: 'prompt',
          message: `Vote for ${nominee.name} (${nominee.code}).\nEnter number of votes (1 vote = GH₵ 0.50):`
        });
      }

      // Show Main Menu: Choice 1 = Vote, Choice 2 = Buy Ticket
      ussdSessions.set(sessionID, {
        state: 'MAIN_MENU',
        phone
      });

      return res.json({
        action: 'prompt',
        message: 'Welcome to Voteeq.\n1. Vote Awards\n2. Buy Event Tickets'
      });
    }

    // Retrieve active session
    const session = ussdSessions.get(sessionID);

    // 1. Main Menu handling
    if (session.state === 'MAIN_MENU') {
      if (input === '1') {
        session.state = 'AWAITING_NOMINEE_CODE';
        ussdSessions.set(sessionID, session);
        return res.json({
          action: 'prompt',
          message: 'Enter Nominee Code (e.g. 101):'
        });
      } else if (input === '2') {
        const db = getDB();
        const events = await db.all("SELECT * FROM events WHERE privacy = 'public' ORDER BY date ASC");
        
        if (events.length === 0) {
          ussdSessions.delete(sessionID);
          return res.json({
            action: 'release',
            message: 'No public events currently available for ticketing.'
          });
        }

        session.state = 'AWAITING_EVENT_SELECTION';
        session.events = events.map(e => ({ id: e.id, title: e.title, price: e.ticket_price }));
        ussdSessions.set(sessionID, session);

        let menuMsg = 'Select Event:\n';
        events.forEach((ev, idx) => {
          menuMsg += `${idx + 1}. ${ev.title} (GH₵ ${ev.ticket_price})\n`;
        });
        return res.json({
          action: 'prompt',
          message: menuMsg.trim()
        });
      } else {
        return res.json({
          action: 'prompt',
          message: 'Invalid option.\nWelcome to Voteeq.\n1. Vote Awards\n2. Buy Event Tickets'
        });
      }
    }

    // 2. Awaiting nominee code (for voting)
    if (session.state === 'AWAITING_NOMINEE_CODE') {
      const nomineeCode = input;
      const nominee = await findNomineeByCode(nomineeCode);

      if (!nominee) {
        ussdSessions.delete(sessionID);
        return res.json({
          action: 'release',
          message: `Nominee code ${nomineeCode} not found. Dial again.`
        });
      }

      session.state = 'AWAITING_VOTES';
      session.nomineeId = nominee.id;
      session.nomineeName = nominee.name;
      session.nomineeCode = nominee.code;
      ussdSessions.set(sessionID, session);

      return res.json({
        action: 'prompt',
        message: `Vote for ${nominee.name} (${nominee.code}).\nEnter number of votes (1 vote = GH₵ 0.50):`
      });
    }

    // 3. Awaiting voting count
    if (session.state === 'AWAITING_VOTES') {
      const voteCount = parseInt(input, 10);
      if (isNaN(voteCount) || voteCount <= 0) {
        return res.json({
          action: 'prompt',
          message: `Invalid number of votes.\nEnter number of votes (1 vote = GH₵ 0.50):`
        });
      }

      session.state = 'AWAITING_CONFIRMATION';
      session.voteCount = voteCount;
      ussdSessions.set(sessionID, session);

      const totalCost = voteCount * 0.5;
      return res.json({
        action: 'prompt',
        message: `Confirm ${voteCount} votes for ${session.nomineeName} costing GH₵ ${totalCost.toFixed(2)}?\n1. Confirm & Pay\n2. Cancel`
      });
    }

    // 4. Awaiting vote confirmation
    if (session.state === 'AWAITING_CONFIRMATION') {
      if (input === '1') {
        const db = getDB();
        const reference = generateReference('u');

        await db.run(`
          INSERT INTO votes (nominee_id, voter_phone, vote_count, channel, payment_reference, status)
          VALUES (?, ?, ?, 'ussd', ?, 'pending')
        `, [session.nomineeId, session.phone, session.voteCount, reference]);

        ussdSessions.delete(sessionID);

        // Always run simulation for developer console dialer USSD
        setTimeout(async () => {
          try {
            const db = getDB();
            const voteRecord = await db.get('SELECT * FROM votes WHERE payment_reference = ?', [reference]);
            if (voteRecord && voteRecord.status === 'pending') {
              await db.run('UPDATE votes SET status = ? WHERE id = ?', ['completed', voteRecord.id]);
              await db.run(
                'UPDATE nominees SET votes_count = votes_count + ? WHERE id = ?',
                [voteRecord.vote_count, voteRecord.nominee_id]
              );
              console.log(`USSD payment simulation completed for ref: ${reference}`);
              await sendVoteReceipt(voteRecord.id);
              broadcast({
                type: 'VOTE_COMPLETED',
                nomineeId: voteRecord.nominee_id,
                votesCount: voteRecord.vote_count
              });
            }
          } catch (err) {
            console.error('USSD timeout mock process error:', err);
          }
        }, 3000);

        return res.json({
          action: 'release',
          message: mockPaymentsAllowed()
            ? 'Payment prompt sent. Approve MoMo transaction on your phone to complete voting. Thank you!'
            : 'Payment request submitted. Complete MoMo approval on your phone to finish voting.'
        });

      } else {
        ussdSessions.delete(sessionID);
        return res.json({
          action: 'release',
          message: 'Voting cancelled. Thank you.'
        });
      }
    }

    // 5. Awaiting Event selection (for tickets)
    if (session.state === 'AWAITING_EVENT_SELECTION') {
      const idx = parseInt(input, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= session.events.length) {
        let menuMsg = 'Invalid selection. Select Event:\n';
        session.events.forEach((ev, i) => {
          menuMsg += `${i + 1}. ${ev.title} (GH₵ ${ev.price})\n`;
        });
        return res.json({
          action: 'prompt',
          message: menuMsg.trim()
        });
      }

      const selectedEvent = session.events[idx];
      session.state = 'AWAITING_TICKET_QUANTITY';
      session.eventId = selectedEvent.id;
      session.eventTitle = selectedEvent.title;
      session.eventPrice = selectedEvent.price;
      ussdSessions.set(sessionID, session);

      return res.json({
        action: 'prompt',
        message: `Buy tickets for ${selectedEvent.title} (GH₵ ${selectedEvent.price}/each).\nEnter quantity (1-5):`
      });
    }

    // 6. Awaiting ticket quantity
    if (session.state === 'AWAITING_TICKET_QUANTITY') {
      const qty = parseInt(input, 10);
      if (isNaN(qty) || qty <= 0 || qty > 5) {
        return res.json({
          action: 'prompt',
          message: 'Invalid quantity. Enter quantity of tickets (1-5):'
        });
      }

      session.state = 'AWAITING_TICKET_CONFIRMATION';
      session.quantity = qty;
      ussdSessions.set(sessionID, session);

      const totalCost = qty * session.eventPrice;
      return res.json({
        action: 'prompt',
        message: `Confirm ${qty} tickets for ${session.eventTitle} costing GH₵ ${totalCost.toFixed(2)}?\n1. Confirm & Pay\n2. Cancel`
      });
    }

    // 7. Awaiting ticket confirmation
    if (session.state === 'AWAITING_TICKET_CONFIRMATION') {
      if (input === '1') {
        const db = getDB();
        const ticketCode = `TIX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const totalPrice = session.quantity * session.eventPrice;
        const reference = generateReference('tix_ussd');

        try {
          await db.transaction(async (tx) => {
            const capacity = await tx.get(
              'SELECT tickets_sold, total_tickets FROM events WHERE id = ?',
              [session.eventId]
            );
            if (!capacity || capacity.tickets_sold + session.quantity > capacity.total_tickets) {
              throw new Error('SOLD_OUT');
            }
            await tx.run(`
              INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
              VALUES (?, ?, 'USSD Buyer', 'ussd@voteeq.online', ?, ?, ?, ?, 'pending')
            `, [session.eventId, ticketCode, session.phone, session.quantity, totalPrice, reference]);
          });
        } catch (txErr) {
          if (txErr.message === 'SOLD_OUT') {
            ussdSessions.delete(sessionID);
            return res.json({
              action: 'release',
              message: 'Sorry, this event is sold out or has insufficient tickets remaining.'
            });
          }
          throw txErr;
        }

        ussdSessions.delete(sessionID);

        // Always run simulation for developer console dialer USSD
        setTimeout(async () => {
          try {
            const db = getDB();
            const ticketRecord = await db.get('SELECT * FROM tickets WHERE payment_reference = ?', [reference]);
            if (ticketRecord && ticketRecord.payment_status === 'pending') {
              await db.run("UPDATE tickets SET payment_status = 'paid' WHERE id = ?", [ticketRecord.id]);
              await db.run("UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?", [ticketRecord.quantity, ticketRecord.event_id]);
              console.log(`USSD ticket payment simulation completed for ref: ${reference}`);
              const event = await db.get('SELECT * FROM events WHERE id = ?', [ticketRecord.event_id]);
              const logMsg = `
========================================
SMS/EMAIL TICKET RECEIPT (USSD MOCK)
Ticket ID: TIX_${ticketRecord.id}_${ticketRecord.ticket_code}
Event: ${event ? event.title : 'Event'}
Venue: ${event ? event.venue : 'TBA'}
Date: ${event ? formatEventDateForDisplay(event.date) : 'TBA'}
Buyer: ${ticketRecord.buyer_name} (${ticketRecord.buyer_phone})
Quantity: ${ticketRecord.quantity}
Price Paid: GH₵ ${ticketRecord.price_paid.toFixed(2)}
Verification Ticket Code: ${ticketRecord.ticket_code}
Payment Reference: ${ticketRecord.payment_reference}
Status: Completed
Date/Time: ${new Date().toISOString()}
========================================
\n`;
              fs.appendFileSync(receiptsLogPath, logMsg);
            }
          } catch (err) {
            console.error('USSD ticket timeout mock error:', err);
          }
        }, 3000);

        return res.json({
          action: 'release',
          message: mockPaymentsAllowed()
            ? 'Payment prompt sent. Approve MoMo transaction on your phone to complete purchase. Thank you!'
            : 'Payment request submitted. Complete MoMo approval on your phone to finish your purchase.'
        });

      } else {
        ussdSessions.delete(sessionID);
        return res.json({
          action: 'release',
          message: 'Ticket purchase cancelled. Thank you.'
        });
      }
    }

    // Default catch-all
    ussdSessions.delete(sessionID);
    return res.json({
      action: 'release',
      message: 'System error. Please try again.'
    });

  } catch (err) {
    console.error('USSD Error:', err);
    ussdSessions.delete(sessionID);
    res.json({
      action: 'release',
      message: 'System error. Please try again later.'
    });
  }
});


// GET payment transaction status (requires status token from checkout)
app.get('/api/payment/status/:reference', rateLimiter(1 * 60 * 1000, 30), async (req, res) => {
  const { reference } = req.params;
  const token = req.query.token;
  if (!reference) {
    return res.status(400).json({ error: 'Reference parameter is required' });
  }
  if (!verifyStatusToken(reference, token)) {
    return res.status(403).json({ error: 'Invalid or missing payment status token' });
  }
  try {
    const db = getDB();
    let status = 'pending';
    let details = null;
    let type = 'vote';

    const vote = await db.get(`
      SELECT v.*, n.name as nominee_name 
      FROM votes v 
      JOIN nominees n ON v.nominee_id = n.id 
      WHERE v.payment_reference = ?
    `, [reference]);

    if (vote) {
      status = vote.status;
      type = 'vote';
      details = {
        nominee_name: vote.nominee_name,
        vote_count: vote.vote_count,
        amount: vote.amount_paid != null
          ? vote.amount_paid
          : (vote.channel === 'web' ? vote.vote_count * 1.0 : vote.vote_count * 0.5),
        amount_base: vote.amount_base,
        amount_fee: vote.amount_fee,
        timestamp: vote.created_at,
        email: vote.email,
        phone: vote.voter_phone,
      };
    } else {
      const reg = await db.get('SELECT * FROM nominee_registrations WHERE payment_reference = ?', [reference]);
      if (reg) {
        status = reg.payment_status;
        type = 'nominee_registration';
        details = {
          name: reg.name,
          email: reg.email,
          amount: reg.form_fee,
          timestamp: reg.created_at
        };
      } else {
        const ticket = await db.get(`
          SELECT t.*, e.title as event_title 
          FROM tickets t
          JOIN events e ON t.event_id = e.id
          WHERE t.payment_reference = ?
        `, [reference]);
        if (ticket) {
          status = ticket.payment_status === 'paid' ? 'completed' : ticket.payment_status;
          type = 'ticket';
          details = {
            event_title: ticket.event_title,
            buyer_name: ticket.buyer_name,
            quantity: ticket.quantity,
            amount: ticket.price_paid,
            timestamp: ticket.created_at,
            ticket_code: ticket.ticket_code,
            email: ticket.buyer_email,
            phone: ticket.buyer_phone,
          };
        }
      }
    }

    if (!details) {
      return res.status(404).json({ error: 'Payment reference not found' });
    }

    const rushpayApiKey = process.env.RUSHPAY_API_KEY;
    if (rushpayApiKey && (status === 'pending' || status === 'processing')) {
      try {
        const verified = await verifyRushPayTransaction(reference);
        if (verified && (verified.status === 'completed' || verified.status === 'success' || verified.status === 'paid')) {
          if (type === 'vote') {
            const voteResult = await completeVotePayment(db, reference);
            if (voteResult.outcome === 'completed') {
              runInBackground(() => sendVoteReceipt(voteResult.vote.id));
              broadcast({
                type: 'VOTE_COMPLETED',
                nomineeId: voteResult.nomineeId,
                votesCount: voteResult.votesAdded,
              });
            }
            const freshVote = await db.get(`
              SELECT v.*, n.name as nominee_name
              FROM votes v
              JOIN nominees n ON v.nominee_id = n.id
              WHERE v.payment_reference = ?
            `, [reference]);
            if (freshVote) {
              status = freshVote.status;
              details = {
                nominee_name: freshVote.nominee_name,
                vote_count: freshVote.vote_count,
                amount: freshVote.amount_paid != null
                  ? freshVote.amount_paid
                  : (freshVote.channel === 'web' ? freshVote.vote_count * 1.0 : freshVote.vote_count * 0.5),
                amount_base: freshVote.amount_base,
                amount_fee: freshVote.amount_fee,
                timestamp: freshVote.created_at,
                email: freshVote.email,
                phone: freshVote.voter_phone,
              };
            }
          } else if (type === 'ticket') {
            const ticketResult = await completeTicketPayment(db, reference);
            if (ticketResult.outcome === 'completed') {
              runInBackground(() => sendTicketReceipt(ticketResult.ticket.id));
            }
            const freshTicket = await db.get(`
              SELECT t.*, e.title as event_title
              FROM tickets t
              JOIN events e ON t.event_id = e.id
              WHERE t.payment_reference = ?
            `, [reference]);
            if (freshTicket) {
              status = freshTicket.payment_status === 'paid' ? 'completed' : freshTicket.payment_status;
              details = {
                event_title: freshTicket.event_title,
                buyer_name: freshTicket.buyer_name,
                quantity: freshTicket.quantity,
                amount: freshTicket.price_paid,
                timestamp: freshTicket.created_at,
                ticket_code: freshTicket.ticket_code,
                email: freshTicket.buyer_email,
                phone: freshTicket.buyer_phone,
              };
            }
          } else if (type === 'nominee_registration') {
            const regResult = await completeRegistrationPayment(db, reference);
            if (regResult.outcome === 'completed') {
              status = 'completed';
            }
          }
        }
      } catch (verifyErr) {
        console.warn(`RushPay verify on status check (${reference}):`, verifyErr.message);
      }
    }

    if (type === 'vote' && status === 'completed') {
      const voteRow = await db.get('SELECT id, receipt_sent FROM votes WHERE payment_reference = ?', [reference]);
      if (voteRow && voteRow.receipt_sent !== 1) {
        runInBackground(() => sendVoteReceipt(voteRow.id));
      }
    }

    res.json({
      reference,
      type,
      status,
      details
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify payment status' });
  }
});

// Retrieve tickets by ticket code, or payment reference + buyer email
app.get('/api/tickets/lookup', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
  const ticketCode = (req.query.ticket_code || '').trim();
  const reference = (req.query.reference || req.query.query || '').trim();
  const email = (req.query.email || '').trim().toLowerCase();

  if (!ticketCode && !(reference && email)) {
    return res.status(400).json({
      error: 'Provide ticket_code, or both reference and email to look up tickets.'
    });
  }

  try {
    const db = getDB();
    let tickets;

    if (ticketCode) {
      if (!/^TIX-[A-F0-9]+$/i.test(ticketCode)) {
        return res.status(400).json({ error: 'Invalid ticket code format' });
      }
      tickets = await db.all(`
        SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.ticket_code = ? AND t.payment_status = 'paid'
        ORDER BY t.created_at DESC
      `, [ticketCode.toUpperCase()]);
    } else {
      tickets = await db.all(`
        SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.payment_reference = ? AND LOWER(t.buyer_email) = ? AND t.payment_status = 'paid'
        ORDER BY t.created_at DESC
      `, [reference, email]);
    }
    
    res.json(tickets.map(withNormalizedEventDate));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to lookup tickets' });
  }
});

// Get admin audit logs
app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    const logs = await db.all('SELECT * FROM admin_audit_logs ORDER BY created_at DESC');
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch admin audit logs' });
  }
});

// Create Event
app.post('/api/admin/events', requireAdmin, async (req, res) => {
  const { title, description, date, venue, ticket_price, privacy, access_code, total_tickets } = req.body;
  if (!title || ticket_price === undefined || !total_tickets) {
    return res.status(400).json({ error: 'Title, ticket price, and total capacity are required' });
  }
  try {
    const db = getDB();
    const result = await db.run(`
      INSERT INTO events (title, description, date, venue, ticket_price, privacy, access_code, total_tickets, tickets_sold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [title, description || '', formatEventDateForDisplay(date, ''), venue || '', parseFloat(ticket_price), privacy || 'public', access_code || null, parseInt(total_tickets, 10)]);
    
    const newEventId = result.lastID;
    await logAdminAction(adminUsername(req), 'CREATE_EVENT', `Created event: ${title} (ID: ${newEventId})`);
    res.json({ success: true, id: newEventId, message: 'Event created successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update Event
app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, description, date, venue, ticket_price, privacy, access_code, total_tickets } = req.body;
  if (!title || ticket_price === undefined || !total_tickets) {
    return res.status(400).json({ error: 'Title, ticket price, and total capacity are required' });
  }
  try {
    const db = getDB();
    const existing = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }
    await db.run(`
      UPDATE events 
      SET title = ?, description = ?, date = ?, venue = ?, ticket_price = ?, privacy = ?, access_code = ?, total_tickets = ?
      WHERE id = ?
    `, [title, description || '', formatEventDateForDisplay(date, ''), venue || '', parseFloat(ticket_price), privacy || 'public', access_code || null, parseInt(total_tickets, 10), id]);
    
    await logAdminAction(adminUsername(req), 'UPDATE_EVENT', `Updated event: ${title} (ID: ${id})`);
    res.json({ success: true, message: 'Event updated successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Reset catalog for "Praemia Pro Virtute" Dinner & Awards Night — UMaT Tarkwa (admin only)
app.post('/api/admin/demo/reseed-ACSES', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    await reseedACSESAwards(db);
    await logAdminAction(adminUsername(req), 'RESEED_ACSES_AWARDS', "Reset catalog for \"Praemia Pro Virtute\" Dinner & Awards Night");
    res.json({
      success: true,
      message: `"Praemia Pro Virtute" Dinner & Awards Night loaded with ${ACSES_AWARD_CATEGORIES.length} award categories. Add shortlisted nominees when ACSES sends the list.`,
    });
  } catch (err) {
    console.error('ACSES reseed error:', err);
    res.status(500).json({
      error: err.message || 'Failed to reset for ACSES Awards',
    });
  }
});

// Reset catalog but maintain categories (admin only)
app.post('/api/admin/demo/reset-maintain-categories', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    await resetAllButCategories(db);
    await logAdminAction(adminUsername(req), 'RESET_MAINTAIN_CATEGORIES', "Reset catalog but maintained award categories");
    res.json({
      success: true,
      message: "Database reset completed! All nominees, votes, tickets, and registrations cleared. Award categories have been maintained.",
    });
  } catch (err) {
    console.error('Reset maintain categories error:', err);
    res.status(500).json({
      error: err.message || 'Failed to reset database while maintaining categories',
    });
  }
});


// Legacy campus demo catalog (admin only)
app.post('/api/admin/demo/reseed-campus', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    await reseedCampusDemo(db);
    await logAdminAction(adminUsername(req), 'RESEED_CAMPUS_DEMO', 'Replaced catalog with campus demo events, categories, and nominees');
    res.json({
      success: true,
      message: 'Campus demo data loaded. Nominee login: code 101, PIN 1234 (and 102/4321, 103/9999).',
    });
  } catch (err) {
    console.error('Campus reseed error:', err);
    res.status(500).json({
      error: err.message || 'Failed to load campus demo data',
    });
  }
});

// Delete Event
app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  if (!Number.isFinite(eventId)) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  try {
    const db = getDB();
    const existing = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const ticketCount = await db.get(
      'SELECT COUNT(*) as count FROM tickets WHERE event_id = ?',
      [eventId]
    );
    const nomineeCount = await db.get(
      'SELECT COUNT(*) as count FROM nominees WHERE event_id = ?',
      [eventId]
    );

    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM tickets WHERE event_id = ?', [eventId]);
      await tx.run('UPDATE nominees SET event_id = NULL WHERE event_id = ?', [eventId]);
      await tx.run('DELETE FROM events WHERE id = ?', [eventId]);
    });

    const details = [];
    if (ticketCount.count > 0) {
      details.push(`${ticketCount.count} ticket record(s) removed`);
    }
    if (nomineeCount.count > 0) {
      details.push(`${nomineeCount.count} nominee(s) unlinked from this event`);
    }

    await logAdminAction(
      adminUsername(req),
      'DELETE_EVENT',
      `Deleted event: ${existing.title} (ID: ${eventId})${details.length ? ` — ${details.join('; ')}` : ''}`
    );

    res.json({
      success: true,
      message: details.length
        ? `Event deleted. ${details.join('. ')}.`
        : 'Event deleted successfully!',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  const db = await initDB();
  await cleanupStaleTickets(db);
  server.listen(port, () => {
    console.log(`Voteeq Node.js API running on port ${port} (WebSocket enabled)`);
  });
}

start().catch(err => {
  console.error('Database connection failed:', err);
});
