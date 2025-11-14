// CityDigii Backend API (Vercel Serverless + Eitaayar Integration)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Rate Limiter to avoid spam
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1, // 10 requests per second allowed per IP
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

// Health Check Endpoint
app.get('/', (req, res) => {
  res.json({ ok: true, status: 'CityDigii Backend is running ✅' });
});

// ✅ Transaction Verification (using Eitaayar API)
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Log action
    await pool.query(
      'INSERT INTO logs (action, details) VALUES ($1, $2)',
      ['verify_transaction', { transaction_id, amount }]
    );

    // Condition for manual approval (e.g., higher amount)
    if (amount > 20000000) {
      // Send message to admin via Eitaayar
      const msgText = `🟢 تراکنش جدید برای تأیید:\n💳 شناسه: ${transaction_id}\n💰 مبلغ: ${amount} تومان\n📩 لطفاً بررسی و تأیید فرمایید.`;
      const response = await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.EITAAYAR_CHANNEL,
          text: msgText,
          title: 'تأیید تراکنش'
        })
      });

      const data = await response.json();
      if (!data.ok) throw new Error('Eitaayar message failed.');

      await pool.query(
        'INSERT INTO verifications (transaction_id, amount) VALUES ($1, $2)',
        [transaction_id, amount]
      );

      return res.json({ message: 'Message sent to Eitaayar admin for approval ✅' });
    }

    // Otherwise approve automatically
    return res.json({ message: 'Transaction approved automatically ✅' });
  } catch (err) {
    console.error('❌ Error verifying transaction:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Required for Vercel serverless runtime
module.exports = app;
