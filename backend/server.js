const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { initDB, getDB } = require('./database');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
app.post('/api/nominees/login', async (req, res) => {
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

    // In a real app, sign a JWT. Here, return profile + simple token
    res.json({
      success: true,
      token: `sess_${nominee.code}_${Date.now()}`,
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
    console.error(err);
    res.status(500).json({ error: 'Authentication error' });
  }
});

// 4. Nominee Dashboard Data
app.get('/api/nominees/dashboard/:code', async (req, res) => {
  const { code } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer sess_' + code)) {
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

    res.json({
      nominee,
      recentVotes: votes,
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
app.post('/api/payment/mock-verify', async (req, res) => {
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
  app.listen(port, () => {
    console.log(`Voteeq Node.js API running on port ${port}`);
  });
}

start().catch(err => {
  console.error('Database connection failed:', err);
});
