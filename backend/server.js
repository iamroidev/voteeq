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
app.use(bodyParser.json({ limit: '10mb' })); // support large canvas uploads
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
    const nominees = await db.all(`
      SELECT n.*, c.name as category_name 
      FROM nominees n 
      JOIN categories c ON n.category_id = c.id
      ORDER BY n.votes_count DESC
    `);
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
app.post('/api/nominees/register', async (req, res) => {
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
    <text x="30" y="522" font-family="'Courier New', monospace" font-size="38" font-weight="bold" fill="#ffffff" letter-spacing="1">*920*102*${nominee.code}#</text>
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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vote for ${nominee.name} - Voteeq Awards</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${frontendUrl}/?nominee=${nominee.code}">
  <meta property="og:title" content="Vote for ${nominee.name} - Voteeq Awards">
  <meta property="og:description" content="Support ${nominee.name} in the ${nominee.category_name} category. Dial *920*102*${nominee.code}# or vote online!">
  <meta property="og:image" content="${bannerUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${frontendUrl}/?nominee=${nominee.code}">
  <meta name="twitter:title" content="Vote for ${nominee.name} - Voteeq Awards">
  <meta name="twitter:description" content="Support ${nominee.name} in the ${nominee.category_name} category. Dial *920*102*${nominee.code}# or vote online!">
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
app.post('/api/payment/initialize', async (req, res) => {
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
  // Paystack signature check can go here if header exists, but for ease, check the request body
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
 *   "userData": "*920*102#", // dial string or user entry
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
      // Parse initial dial code: *920*102# or *920*102*101#
      const cleanDial = input.replace(/#/g, '');
      const parts = cleanDial.split('*'); // ["", "920", "102", "101"] or ["", "920", "102"]

      // If nominee code is dialled directly, e.g. *920*102*101#
      if (parts.length >= 4) {
        const nomineeCode = parts[3];
        const nominee = await findNomineeByCode(nomineeCode);

        if (!nominee) {
          return res.json({
            action: 'release',
            message: `Nominee not found for code ${nomineeCode}. Please dial *920*102# to try again.`
          });
        }

        // Save session state
        ussdSessions.set(sessionID, {
          state: 'AWAITING_VOTES',
          nomineeId: nominee.id,
          nomineeName: nominee.name,
          nomineeCode: nominee.code,
          phone
        });

        return res.json({
          action: 'prompt',
          message: `Vote for ${nominee.name} (${nominee.code}).\nEnter number of votes (1 vote = 0.50 GHS):`
        });
      }

      // Normal generic dial: *920*102#
      ussdSessions.set(sessionID, {
        state: 'AWAITING_NOMINEE_CODE',
        phone
      });

      return res.json({
        action: 'prompt',
        message: 'Welcome to Voteeq.\nEnter Nominee Code (e.g. 101):'
      });
    }

    // Retrieve session
    const session = ussdSessions.get(sessionID);

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
        message: `Vote for ${nominee.name} (${nominee.code}).\nEnter number of votes (1 vote = 0.50 GHS):`
      });
    }

    if (session.state === 'AWAITING_VOTES') {
      const voteCount = parseInt(input, 10);
      if (isNaN(voteCount) || voteCount <= 0) {
        return res.json({
          action: 'prompt',
          message: `Invalid number of votes.\nEnter number of votes (1 vote = 0.50 GHS):`
        });
      }

      session.state = 'AWAITING_CONFIRMATION';
      session.voteCount = voteCount;
      ussdSessions.set(sessionID, session);

      const totalCost = voteCount * 0.5; // Custom promo USSD rate: 0.50 GHS/vote
      return res.json({
        action: 'prompt',
        message: `Confirm ${voteCount} votes for ${session.nomineeName} costing GHS ${totalCost.toFixed(2)}?\n1. Confirm & Pay\n2. Cancel`
      });
    }

    if (session.state === 'AWAITING_CONFIRMATION') {
      if (input === '1') {
        const db = getDB();
        const reference = `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        // Save a pending USSD payment/vote record
        await db.run(`
          INSERT INTO votes (nominee_id, voter_phone, vote_count, channel, payment_reference, status)
          VALUES (?, ?, ?, 'ussd', ?, 'pending')
        `, [session.nomineeId, session.phone, session.voteCount, reference]);

        // Clean session
        ussdSessions.delete(sessionID);

        // In a real production setup, we trigger Paystack's Mobile Money Charge API
        // E.g., charging session.phone via MTN MoMo / Telecel Cash.
        // We will trigger a mock completion call in 2 seconds to simulate standard sandbox flow
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

              // Trigger SMS receipt simulation
              await sendReceipt(voteRecord.id);

              // Broadcast real-time WebSocket update
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


// Start server
async function start() {
  await initDB();
  server.listen(port, () => {
    console.log(`Voteeq Node.js API running on port ${port} (WebSocket enabled)`);
  });
}

start().catch(err => {
  console.error('Database connection failed:', err);
});
