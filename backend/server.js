const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { initDB, getDB } = require('./database');
require('dotenv').config();

const app = express();
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

// Dynamic HMAC token security (alternative to heavy JWT library)
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'voteeq_super_secret_key_123';

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
  if (signature !== expectedSignature) return null;
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
const rateLimits = new Map();
function rateLimiter(limitWindowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();

    if (!rateLimits.has(ip)) {
      rateLimits.set(ip, []);
    }

    let timestamps = rateLimits.get(ip);
    timestamps = timestamps.filter(t => now - t < limitWindowMs);

    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    timestamps.push(now);
    rateLimits.set(ip, timestamps);
    next();
  };
}

// Email/SMS receipt logger
const fs = require('fs');
const path = require('path');
const receiptsLogPath = path.resolve(__dirname, 'receipts.log');

async function sendReceipt(voteId) {
  try {
    const db = getDB();
    const vote = await db.get(`
      SELECT v.*, n.name as nominee_name 
      FROM votes v 
      JOIN nominees n ON v.nominee_id = n.id 
      WHERE v.id = ?
    `, [voteId]);

    if (!vote || vote.status !== 'completed' || vote.receipt_sent === 1) {
      return;
    }

    const amountGHS = vote.channel === 'web' ? vote.vote_count * 1.0 : vote.vote_count * 0.5;
    const timestamp = new Date(vote.created_at || Date.now()).toLocaleString();

    let receiptMessage = `
========================================
VOTEEQ AWARDS OFFICIAL RECEIPT
========================================
Receipt ID: REC_${vote.id}_${vote.payment_reference}
Timestamp: ${timestamp}
Nominee Voted For: ${vote.nominee_name.toUpperCase()} (ID: ${vote.nominee_id})
Votes Count: ${vote.vote_count}
Amount Paid: GHS ${amountGHS.toFixed(2)}
Payment Channel: ${vote.channel.toUpperCase()}
Payment Reference: ${vote.payment_reference}
Voter Contact (Phone): ${vote.voter_phone || 'N/A'}
`;

    if (vote.email) {
      receiptMessage += `Voter Contact (Email): ${vote.email}\n`;
      receiptMessage += `
Email Notification Sent To: ${vote.email}
----------------------------------------
Subject: Vote Confirmation - Voteeq Awards
Dear Voter,
Thank you for voting in the Voteeq Awards!
We have verified your payment of GHS ${amountGHS.toFixed(2)} for ${vote.vote_count} votes for candidate ${vote.nominee_name}.
Reference: ${vote.payment_reference}
----------------------------------------\n`;
    }

    receiptMessage += `
SMS Notification Sent To: ${vote.voter_phone}
----------------------------------------
Voteeq Awards: Verified GHS ${amountGHS.toFixed(2)} for ${vote.vote_count} votes to ${vote.nominee_name}. Thank you!
----------------------------------------\n`;

    receiptMessage += `========================================\n\n`;

    // Append to file
    fs.appendFileSync(receiptsLogPath, receiptMessage, 'utf8');
    console.log(`Receipt generated and logged to receipts.log for Vote ID: ${vote.id}`);

    // Mark receipt as sent
    await db.run('UPDATE votes SET receipt_sent = 1 WHERE id = ?', [vote.id]);

  } catch (err) {
    console.error('Error generating receipt:', err);
  }
}

// CORS: Allow frontend origins from Vercel + local dev
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
  : ['http://localhost:5173', 'http://localhost:4173', 'https://voteeq-roi-dev.vercel.app', 'https://frontend-roi-dev.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(bodyParser.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
})); // support large canvas uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Ensure banners folder exists
const bannersDir = path.resolve(__dirname, 'banners');
if (!fs.existsSync(bannersDir)) {
  fs.mkdirSync(bannersDir);
}
app.use('/banners', express.static(bannersDir));

// In-memory store for active USSD sessions
const ussdSessions = new Map();

// Helper: Fetch nominee by code
async function findNomineeByCode(code) {
  const db = getDB();
  return await db.get('SELECT * FROM nominees WHERE code = ?', [code]);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Get Categories
app.get('/api/categories', async (req, res) => {
  try {
    const db = getDB();
    const categories = await db.all('SELECT * FROM categories ORDER BY name ASC');
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
    const nominees = await db.all(`
      SELECT n.*, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      ${eventId ? 'WHERE n.event_id = ? OR n.event_id IS NULL' : ''}
      ORDER BY n.votes_count DESC
    `, eventId ? [eventId] : []);
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

    if (nominee.passcode !== passcode) {
      return res.status(401).json({ error: 'Invalid PIN code' });
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
        votes_count: nominee.votes_count
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

    await db.run('UPDATE nominees SET passcode = ? WHERE code = ?', [newPin, code]);

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

  if (username === 'admin' && password === 'admin123') {
    const token = generateToken({
      role: 'admin',
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

// 1b. Get all events
app.get('/api/events', async (req, res) => {
  try {
    const db = getDB();
    const events = await db.all('SELECT * FROM events ORDER BY date ASC');
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching events' });
  }
});

// 1c. Purchase event ticket (initialize payment reference)
app.post('/api/tickets/purchase', rateLimiter(5 * 60 * 1000, 25), async (req, res) => {
  const { event_id, buyer_name, buyer_email, buyer_phone, quantity, access_code } = req.body;

  if (!event_id || !buyer_name || !buyer_email || !buyer_phone || !quantity) {
    return res.status(400).json({ error: 'Missing required fields for ticket purchase' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0 || qty > 5) {
    return res.status(400).json({ error: 'Invalid quantity. A maximum of 5 tickets can be bought at once.' });
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

    if (event.tickets_sold + qty > event.total_tickets) {
      return res.status(400).json({ error: 'Ticket booking failed: Sold out or insufficient tickets remaining.' });
    }

    // Generate secure 8-character uppercase alphanumeric code
    const ticketCode = `TIX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const totalPrice = event.ticket_price * qty;
    const reference = `tix_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await db.run(`
      INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [event_id, ticketCode, buyer_name, buyer_email, buyer_phone, qty, totalPrice, reference]);

    res.json({
      reference,
      authorization_url: `/mock-paystack-checkout?reference=${reference}&amount=${totalPrice}&event=${encodeURIComponent(event.title)}&quantity=${qty}&isTicket=true`,
      isMock: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initialize ticket purchase' });
  }
});

// Mock Paystack Ticket Success Trigger
app.post('/api/payment/mock-verify-ticket', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
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

    if (ticketRecord.payment_status === 'pending') {
      await db.run("UPDATE tickets SET payment_status = 'paid' WHERE id = ?", [ticketRecord.id]);
      await db.run("UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?", [ticketRecord.quantity, ticketRecord.event_id]);
      
      // Write receipt log to receipts.log
      const event = await db.get('SELECT * FROM events WHERE id = ?', [ticketRecord.event_id]);
      const logMsg = `
========================================
SMS/EMAIL TICKET RECEIPT (MOCK)
Ticket ID: TIX_${ticketRecord.id}_${ticketRecord.ticket_code}
Event: ${event ? event.title : 'Event'}
Venue: ${event ? event.venue : 'TBA'}
Date: ${event ? event.date : 'TBA'}
Buyer: ${ticketRecord.buyer_name} (${ticketRecord.buyer_phone})
Quantity: ${ticketRecord.quantity}
Price Paid: GHS ${ticketRecord.price_paid.toFixed(2)}
Verification Ticket Code: ${ticketRecord.ticket_code}
Payment Reference: ${ticketRecord.payment_reference}
Status: Completed
Date/Time: ${new Date().toISOString()}
========================================
\n`;
      fs.appendFileSync(receiptsLogPath, logMsg);

      const ticketDetails = await db.get(`
        SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.id = ?
      `, [ticketRecord.id]);

      return res.json({ 
        success: true, 
        message: 'Ticket payment verified successfully!', 
        ticket: ticketDetails 
      });
    } else {
      const ticketDetails = await db.get(`
        SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
        FROM tickets t
        JOIN events e ON t.event_id = e.id
        WHERE t.id = ?
      `, [ticketRecord.id]);
      return res.json({ 
        success: true, 
        message: 'Ticket payment already processed', 
        ticket: ticketDetails 
      });
    }
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

// 3f. Create Nominee
app.post('/api/admin/nominees', requireAdmin, async (req, res) => {
  const { code, name, photo_url, category_id } = req.body;
  if (!code || !name || !category_id) {
    return res.status(400).json({ error: 'Code, Name and Category are required' });
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
      'INSERT INTO nominees (code, name, photo_url, category_id, passcode, votes_count) VALUES (?, ?, ?, ?, ?, 0)',
      [
        code,
        name,
        photo_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
        category_id,
        `PENDING_ACT_${activationCode}`
      ]
    );
    res.json({ 
      success: true, 
      message: 'Nominee added in PENDING activation state!',
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

    // Get recent votes
    const votes = await db.all(`
      SELECT id, voter_phone, vote_count, channel, status, created_at
      FROM votes
      WHERE nominee_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [nominee.id]);

    // Sum vote methods
    const channelStats = await db.all(`
      SELECT channel, SUM(vote_count) as total
      FROM votes
      WHERE nominee_id = ? AND status = 'completed'
      GROUP BY channel
    `, [nominee.id]);

    const hasCustomBanner = fs.existsSync(path.join(bannersDir, `${code}.png`));

    res.json({
      nominee,
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

// 4a. Nominee save customized campaign poster banner to server
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

  try {
    // Parse base64 png image data
    const base64Data = image.replace(/^data:image\/png;base64,/, '');
    const filename = path.join(bannersDir, `${code}.png`);
    fs.writeFileSync(filename, base64Data, 'base64');
    console.log(`Custom banner saved for nominee ${code} to ${filename}`);
    res.json({ success: true, message: 'Share card banner saved successfully!' });
  } catch (err) {
    console.error('Save banner error:', err);
    res.status(500).json({ error: 'Failed to save campaign banner on server' });
  }
});

// 4b. Dynamic SVG Campaign share card generation
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
    <text x="30" y="470" font-family="'Inter', sans-serif" font-size="14" fill="#8c8273">Dial shortcode on your mobile phone to support:</text>
    <text x="30" y="522" font-family="'Courier New', monospace" font-size="38" font-weight="bold" fill="#ffffff" letter-spacing="1">*920*566*${nominee.code}#</text>
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
    
    // Check if custom banner exists on disk
    const customBannerPath = path.join(bannersDir, `${code}.png`);
    const hasCustomBanner = fs.existsSync(customBannerPath);
    const bannerUrl = hasCustomBanner 
      ? `${serverUrl}/banners/${code}.png`
      : `${serverUrl}/api/nominees/share-image/${code}`;

    const frontendUrl = process.env.FRONTEND_URL || (process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : 'http://localhost:5173');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vote for ${nominee.name} - Voteeq Awards</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${frontendUrl}/?nominee=${nominee.code}">
  <meta property="og:title" content="Vote for ${nominee.name} - Voteeq Awards">
  <meta property="og:description" content="Support ${nominee.name} in the ${nominee.category_name} category. Dial *920*566*${nominee.code}# or vote online!">
  <meta property="og:image" content="${bannerUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${frontendUrl}/?nominee=${nominee.code}">
  <meta name="twitter:title" content="Vote for ${nominee.name} - Voteeq Awards">
  <meta name="twitter:description" content="Support ${nominee.name} in the ${nominee.category_name} category. Dial *920*566*${nominee.code}# or vote online!">
  <meta name="twitter:image" content="${bannerUrl}">

  <!-- Redirect to the React App -->
  <script type="text/javascript">
    window.location.href = "${frontendUrl}/?nominee=${nominee.code}";
  </script>
  <meta http-equiv="refresh" content="0;url=${frontendUrl}/?nominee=${nominee.code}">
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; padding: 4rem;">
    <h2>Redirecting to voting portal...</h2>
    <p>If you are not redirected, <a href="${frontendUrl}/?nominee=${nominee.code}">click here</a>.</p>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('Share link error:', err);
    res.status(500).send('Error rendering share card');
  }
});

// 5. Initialize Paystack Payment / Vote Purchase
app.post('/api/payment/initialize', rateLimiter(1 * 60 * 1000, 10), async (req, res) => {
  const { nomineeId, email, phone, voteCount } = req.body;

  if (!nomineeId || !voteCount || voteCount <= 0) {
    return res.status(400).json({ error: 'Invalid nomination id or vote count' });
  }

  const amountPerVote = 1; // 1 GHS per vote
  const totalGHS = amountPerVote * voteCount;
  // Paystack expects amount in minor units (Pesewas in GH, Kobo in NG). So multiplied by 100
  const amountMinor = totalGHS * 100;

  const reference = `v_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  try {
    const db = getDB();
    const nominee = await db.get('SELECT * FROM nominees WHERE id = ?', [nomineeId]);
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    // Insert pending vote record
    await db.run(`
      INSERT INTO votes (nominee_id, voter_phone, vote_count, channel, payment_reference, status)
      VALUES (?, ?, ?, 'web', ?, 'pending')
    `, [nomineeId, phone || 'Web Client', voteCount, reference]);

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (secretKey) {
      // Real Paystack integration
      // We will perform an HTTP POST request to Paystack API
      const paystackPayload = JSON.stringify({
        email: email || 'voter@voteeq.com',
        amount: amountMinor,
        currency: 'GHS',
        reference: reference,
        callback_url: `${req.headers.origin || 'http://localhost:5173'}/payment-status`,
        metadata: {
          nomineeId,
          voteCount,
          phone
        }
      });

      const options = {
        hostname: 'api.paystack.co',
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(paystackPayload)
        }
      };

      const paystackReq = http.request(options, (paystackRes) => {
        let data = '';
        paystackRes.on('data', (chunk) => { data += chunk; });
        paystackRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status && parsed.data) {
              res.json({
                reference,
                authorization_url: parsed.data.authorization_url,
                access_code: parsed.data.access_code,
                isMock: false
              });
            } else {
              res.status(400).json({ error: parsed.message || 'Paystack initialization failed' });
            }
          } catch (e) {
            res.status(500).json({ error: 'Failed to parse Paystack response' });
          }
        });
      });

      paystackReq.on('error', (err) => {
        console.error('Paystack req error:', err);
        res.status(500).json({ error: 'Paystack connection error' });
      });

      paystackReq.write(paystackPayload);
      paystackReq.end();
    } else {
      // MOCK Paystack Flow for offline sandbox testing
      // We return a mock authorization url that our frontend can catch
      res.json({
        reference,
        authorization_url: `/mock-paystack-checkout?reference=${reference}&amount=${totalGHS}&nominee=${encodeURIComponent(nominee.name)}&votes=${voteCount}`,
        isMock: true
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initiate checkout transaction' });
  }
});

// 6. Paystack Webhook (Verify/Complete Payment)
app.post('/api/payment/webhook', async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (secretKey) {
    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return res.status(401).send('Missing Paystack signature header');
    }
    const hash = crypto.createHmac('sha512', secretKey).update(req.rawBody || '').digest('hex');
    if (hash !== signature) {
      console.warn('Invalid webhook signature attempt');
      return res.status(401).send('Invalid Paystack signature');
    }
  }

  const event = req.body;
  if (!event || !event.event) {
    return res.status(400).send('Invalid webhook payload');
  }

  // Handle charge.success
  if (event.event === 'charge.success') {
    const data = event.data;
    const reference = data.reference;

    try {
      const db = getDB();

      if (reference && reference.startsWith('tix_')) {
        // Handle ticket payment
        const ticketRecord = await db.get('SELECT * FROM tickets WHERE payment_reference = ?', [reference]);
        if (ticketRecord && ticketRecord.payment_status === 'pending') {
          await db.run("UPDATE tickets SET payment_status = 'paid' WHERE id = ?", [ticketRecord.id]);
          await db.run("UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?", [ticketRecord.quantity, ticketRecord.event_id]);
          console.log(`Ticket payment confirmed for reference: ${reference}`);
          
          // Write receipt log to receipts.log
          const event = await db.get('SELECT * FROM events WHERE id = ?', [ticketRecord.event_id]);
          const logMsg = `
========================================
SMS/EMAIL TICKET RECEIPT
Ticket ID: TIX_${ticketRecord.id}_${ticketRecord.ticket_code}
Event: ${event ? event.title : 'Event'}
Venue: ${event ? event.venue : 'TBA'}
Date: ${event ? event.date : 'TBA'}
Buyer: ${ticketRecord.buyer_name} (${ticketRecord.buyer_phone})
Quantity: ${ticketRecord.quantity}
Price Paid: GHS ${ticketRecord.price_paid.toFixed(2)}
Verification Ticket Code: ${ticketRecord.ticket_code}
Payment Reference: ${ticketRecord.payment_reference}
Status: Completed
Date/Time: ${new Date().toISOString()}
========================================
\n`;
          fs.appendFileSync(receiptsLogPath, logMsg);
        }
        return res.status(200).send('Webhook processed successfully');
      }

      if (reference && reference.startsWith('reg_')) {
        // Handle nominee onboarding registration form payment
        const regRecord = await db.get('SELECT * FROM nominee_registrations WHERE payment_reference = ?', [reference]);
        if (regRecord && regRecord.payment_status === 'pending') {
          await db.run("UPDATE nominee_registrations SET payment_status = 'completed' WHERE id = ?", [regRecord.id]);
          console.log(`Registration Form payment confirmed for reference: ${reference}`);
        }
        return res.status(200).send('Webhook processed successfully');
      }

      const voteRecord = await db.get('SELECT * FROM votes WHERE payment_reference = ?', [reference]);

      if (voteRecord && voteRecord.status === 'pending') {
        // Update vote status
        await db.run('UPDATE votes SET status = ? WHERE id = ?', ['completed', voteRecord.id]);
        
        // Update nominee tally
        await db.run(
          'UPDATE nominees SET votes_count = votes_count + ? WHERE id = ?',
          [voteRecord.vote_count, voteRecord.nominee_id]
        );

        console.log(`Payment confirmed! Added ${voteRecord.vote_count} votes for nominee ID ${voteRecord.nominee_id}`);

        // Send Email/SMS receipt simulator
        await sendReceipt(voteRecord.id);

        // Broadcast to WebSocket clients
        broadcast({
          type: 'VOTE_COMPLETED',
          nomineeId: voteRecord.nominee_id,
          votesCount: voteRecord.vote_count
        });
      }
      res.status(200).send('Webhook processed successfully');
    } catch (err) {
      console.error('Webhook DB Error:', err);
      res.status(500).send('Database error inside webhook handler');
    }
  } else {
    res.status(200).send('Unhandled event type');
  }
});

// Mock Paystack Payment Success Trigger (specifically for sandbox testing from UI)
app.post('/api/payment/mock-verify', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ error: 'Reference code is required' });
  }

  try {
    const db = getDB();
    const voteRecord = await db.get('SELECT * FROM votes WHERE payment_reference = ?', [reference]);

    if (!voteRecord) {
      return res.status(404).json({ error: 'Transaction reference not found' });
    }

    if (voteRecord.status === 'pending') {
      await db.run('UPDATE votes SET status = ? WHERE id = ?', ['completed', voteRecord.id]);
      await db.run(
        'UPDATE nominees SET votes_count = votes_count + ? WHERE id = ?',
        [voteRecord.vote_count, voteRecord.nominee_id]
      );

      // Trigger Email/SMS receipt simulation
      await sendReceipt(voteRecord.id);

      // Broadcast WebSocket real-time update
      broadcast({
        type: 'VOTE_COMPLETED',
        nomineeId: voteRecord.nominee_id,
        votesCount: voteRecord.vote_count
      });

      return res.json({ success: true, message: 'Mock payment verified successfully!' });
    } else {
      return res.json({ success: true, message: 'Transaction already processed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mock validation error' });
  }
});

// Mock Paystack Registration Form Success Trigger
app.post('/api/payment/mock-verify-registration', rateLimiter(1 * 60 * 1000, 20), async (req, res) => {
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

  const formFee = 10.00; // GHS 10.00 registration form fee
  const reference = `reg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  try {
    const db = getDB();
    
    // Save pending registration
    await db.run(`
      INSERT INTO nominee_registrations (name, email, phone, photo_url, category_id, custom_category, bio, payment_reference, payment_status, form_fee, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'pending')
    `, [
      name, 
      email, 
      phone, 
      photo_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
      category_id ? parseInt(category_id) : null,
      custom_category || null,
      bio || '',
      reference,
      formFee
    ]);

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (secretKey) {
      // Real Paystack charge initialization for GHS 10.00
      const paystackPayload = JSON.stringify({
        email: email,
        amount: formFee * 100, // minor units
        currency: 'GHS',
        reference: reference,
        callback_url: `${req.headers.origin || 'http://localhost:5173'}/payment-status`,
        metadata: {
          type: 'nominee_form',
          name,
          phone
        }
      });

      const options = {
        hostname: 'api.paystack.co',
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(paystackPayload)
        }
      };

      const paystackReq = http.request(options, (paystackRes) => {
        let data = '';
        paystackRes.on('data', (chunk) => { data += chunk; });
        paystackRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status && parsed.data) {
              res.json({
                reference,
                authorization_url: parsed.data.authorization_url,
                access_code: parsed.data.access_code,
                isMock: false
              });
            } else {
              res.status(400).json({ error: parsed.message || 'Form purchase failed to initialize' });
            }
          } catch (e) {
            res.status(500).json({ error: 'Failed to parse Paystack response' });
          }
        });
      });

      paystackReq.on('error', (err) => {
        console.error('Paystack error:', err);
        res.status(500).json({ error: 'Paystack connection error' });
      });

      paystackReq.write(paystackPayload);
      paystackReq.end();
    } else {
      // MOCK Paystack Flow for offline sandbox testing
      res.json({
        reference,
        authorization_url: `/mock-paystack-checkout?reference=${reference}&amount=${formFee}&nominee=${encodeURIComponent('Nominee Form Purchase: ' + name)}&votes=1&isForm=true`,
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
      SELECT r.*, c.name as category_name
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

    // Generate unique 3-digit candidate code
    let assignedCode = '';
    while (true) {
      const candidateCode = Math.floor(100 + Math.random() * 900).toString();
      const duplicate = await db.get('SELECT id FROM nominees WHERE code = ?', [candidateCode]);
      if (!duplicate) {
        assignedCode = candidateCode;
        break;
      }
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

    await logAdminAction('admin', 'APPROVE_REGISTRATION', `Approved registration ID: ${id}, Nominee Name: ${reg.name}, Assigned Code: ${assignedCode}`);

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

    res.json({ 
      success: true, 
      message: 'Onboarding approved! Activation PIN issued.',
      assignedCode,
      activationPin: tempPin
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
    await logAdminAction('admin', 'REJECT_REGISTRATION', `Rejected registration ID: ${id}`);
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
    res.json(tickets);
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
    const ticket = await db.get(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue 
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.ticket_code = ?
    `, [ticket_code.trim()]);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket code is invalid or not found in system database' });
    }

    if (ticket.payment_status !== 'paid') {
      return res.status(400).json({ error: `Ticket status is ${ticket.payment_status.toUpperCase()}. Complete payment first.` });
    }

    if (ticket.scanned === 1) {
      return res.status(400).json({ 
        error: `ACCESS DENIED: Ticket has already been checked in! Checked in at: ${new Date(ticket.scanned_at).toLocaleString()}` 
      });
    }

    const scannedAt = new Date().toISOString();
    await db.run('UPDATE tickets SET scanned = 1, scanned_at = ? WHERE id = ?', [scannedAt, ticket.id]);
    await logAdminAction('admin', 'SCAN_TICKET', `Scanned ticket code: ${ticket_code.trim()}, Event: ${ticket.event_title}, Buyer: ${ticket.buyer_name}`);

    res.json({
      success: true,
      message: 'ACCESS GRANTED - Check-in successful',
      ticket: {
        buyer_name: ticket.buyer_name,
        event_title: ticket.event_title,
        quantity: ticket.quantity,
        scanned_at: scannedAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Check-in validation error occurred' });
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
 *   "userData": "*920*566#", // dial string or user entry
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
app.post('/api/ussd', async (req, res) => {
  const { sessionID, msisdn, newSession, userData } = req.body;

  if (!sessionID || !msisdn) {
    return res.status(400).json({ error: 'Missing sessionID or msisdn' });
  }

  const phone = msisdn;
  const input = userData ? userData.trim() : '';

  try {
    // If it's a completely new session
    if (newSession === '1' || newSession === 1 || !ussdSessions.has(sessionID)) {
      // Parse initial dial code: *920*566# or *920*566*101#
      const cleanDial = input.replace(/#/g, '');
      const parts = cleanDial.split('*'); // ["", "920", "566", "101"] or similar

      // Direct nominee vote shortcut: e.g. *920*566*101#
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
        const reference = `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        await db.run(`
          INSERT INTO votes (nominee_id, voter_phone, vote_count, channel, payment_reference, status)
          VALUES (?, ?, ?, 'ussd', ?, 'pending')
        `, [session.nomineeId, session.phone, session.voteCount, reference]);

        ussdSessions.delete(sessionID);

        setTimeout(async () => {
          try {
            const voteRecord = await db.get('SELECT * FROM votes WHERE payment_reference = ?', [reference]);
            if (voteRecord && voteRecord.status === 'pending') {
              await db.run('UPDATE votes SET status = ? WHERE id = ?', ['completed', voteRecord.id]);
              await db.run(
                'UPDATE nominees SET votes_count = votes_count + ? WHERE id = ?',
                [voteRecord.vote_count, voteRecord.nominee_id]
              );
              console.log(`USSD payment simulation completed for ref: ${reference}`);
              await sendReceipt(voteRecord.id);
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
          message: 'Payment prompt sent. Approve MoMo transaction on your phone to complete voting. Thank you!'
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
        const reference = `tix_ussd_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        await db.run(`
          INSERT INTO tickets (event_id, ticket_code, buyer_name, buyer_email, buyer_phone, quantity, price_paid, payment_reference, payment_status)
          VALUES (?, ?, 'USSD Buyer', 'ussd@voteeq.com', ?, ?, ?, ?, 'pending')
        `, [session.eventId, ticketCode, session.phone, session.quantity, totalPrice, reference]);

        ussdSessions.delete(sessionID);

        // Simulate payment completion
        setTimeout(async () => {
          try {
            const ticketRecord = await db.get('SELECT * FROM tickets WHERE payment_reference = ?', [reference]);
            if (ticketRecord && ticketRecord.payment_status === 'pending') {
              await db.run("UPDATE tickets SET payment_status = 'paid' WHERE id = ?", [ticketRecord.id]);
              await db.run("UPDATE events SET tickets_sold = tickets_sold + ? WHERE id = ?", [ticketRecord.quantity, ticketRecord.event_id]);
              console.log(`USSD ticket payment simulation completed for ref: ${reference}`);
              
              // Write receipt log to receipts.log
              const event = await db.get('SELECT * FROM events WHERE id = ?', [ticketRecord.event_id]);
              const logMsg = `
========================================
SMS/EMAIL TICKET RECEIPT (USSD MOCK)
Ticket ID: TIX_${ticketRecord.id}_${ticketRecord.ticket_code}
Event: ${event ? event.title : 'Event'}
Venue: ${event ? event.venue : 'TBA'}
Date: ${event ? event.date : 'TBA'}
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
          message: 'Payment prompt sent. Approve MoMo transaction on your phone to complete purchase. Thank you!'
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


// GET payment transaction status
app.get('/api/payment/status/:reference', async (req, res) => {
  const { reference } = req.params;
  if (!reference) {
    return res.status(400).json({ error: 'Reference parameter is required' });
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
        amount: vote.channel === 'web' ? vote.vote_count * 1.0 : vote.vote_count * 0.5,
        timestamp: vote.created_at
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
            ticket_code: ticket.ticket_code
          };
        }
      }
    }

    if (!details) {
      return res.status(404).json({ error: 'Payment reference not found' });
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

// Retrieve tickets by email, phone, reference, or code
app.get('/api/tickets/lookup', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  const cleanQuery = query.trim();
  try {
    const db = getDB();
    const tickets = await db.all(`
      SELECT t.*, e.title as event_title, e.date as event_date, e.venue as event_venue
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE (t.payment_reference = ? OR t.buyer_email = ? OR t.buyer_phone = ? OR t.ticket_code = ?)
        AND t.payment_status = 'paid'
      ORDER BY t.created_at DESC
    `, [cleanQuery, cleanQuery, cleanQuery, cleanQuery]);
    
    res.json(tickets);
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
    `, [title, description || '', date || '', venue || '', parseFloat(ticket_price), privacy || 'public', access_code || null, parseInt(total_tickets, 10)]);
    
    const newEventId = result.lastID;
    await logAdminAction('admin', 'CREATE_EVENT', `Created event: ${title} (ID: ${newEventId})`);
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
    `, [title, description || '', date || '', venue || '', parseFloat(ticket_price), privacy || 'public', access_code || null, parseInt(total_tickets, 10), id]);
    
    await logAdminAction('admin', 'UPDATE_EVENT', `Updated event: ${title} (ID: ${id})`);
    res.json({ success: true, message: 'Event updated successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete Event
app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDB();
    const existing = await db.get('SELECT * FROM events WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }
    await db.run('DELETE FROM events WHERE id = ?', [id]);
    await logAdminAction('admin', 'DELETE_EVENT', `Deleted event: ${existing.title} (ID: ${id})`);
    res.json({ success: true, message: 'Event deleted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
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
