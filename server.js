// server.js - CityDigii Backend API (Vercel Serverless Compatible)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const twilio = require('twilio');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Rate Limiter
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
});
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).send('Too Many Requests');
  }
});

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Twilio Client
const twilioClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const BUSINESS_PHONE = '+989382965042';
const ADMIN_PHONE = '+989122965042';

// Initialize DB Tables
(async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255) UNIQUE NOT NULL,
        amount BIGINT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Error initializing DB:', err.message);
  }
})();

// Health Check
app.get('/', (req, res) => {
  res.json({ ok: true, status: 'CityDigii Backend is running ✅' });
});

// Transaction Verification
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;

  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    await pool.query(
      'INSERT INTO logs (action, details) VALUES ($1, $2)',
      ['verify_transaction', { transaction_id, amount }]
    );

    if (amount > 20000000) {
      await twilioClient.messages.create({
        body: `تأیید تراکنش: ID ${transaction_id} با مبلغ ${amount} تومان. تأیید؟ (بله/خیر)`,
        from: BUSINESS_PHONE,
        to: ADMIN_PHONE,
      });

      await pool.query(
        'INSERT INTO verifications (transaction_id, amount) VALUES ($1, $2)',
        [transaction_id, amount]
      );

      return res.json({ message: 'Transaction sent for admin approval' });
    }

    return res.json({ message: 'Transaction approved automatically' });
  } catch (err) {
    console.error('❌ Error verifying transaction:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Required for Vercel serverless
module.exports = app;
