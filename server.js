// server.js - CityDigii Backend API

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
const twilio = require('twilio');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

// Rate Limiter (to prevent abuse)
const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 1, // per second
});
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).send('Too Many Requests');
  }
});

// Database Connection (PostgreSQL on Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Twilio Client
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

// Phone Numbers
const BUSINESS_PHONE = '+989382965042';
const ADMIN_PHONE = '+989122965042';

// Initialize Database Tables
async function initDB() {
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
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing DB:', err);
  }
}
initDB();

// Endpoint: Health Check
app.get('/', (req, res) => {
  res.json({ status: 'CityDigii Backend is running!' });
});

// Endpoint: Handle Transaction Verification
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;

  if (!transaction_id || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Log the request
    await pool.query('INSERT INTO logs (action, details) VALUES ($1, $2)', 
      ['verify_transaction', { transaction_id, amount }]);

    if (amount > 20000000) { // 20,000,000 تومان
      // Send SMS to Admin for approval
      await twilioClient.messages.create({
        body: `تأیید تراکنش: ID ${transaction_id} با مبلغ ${amount} تومان. تأیید؟ (بله/خیر)`,
        from: BUSINESS_PHONE,
        to: ADMIN_PHONE
      });
      // Save to verifications table
      await pool.query('INSERT INTO verifications (transaction_id, amount) VALUES ($1, $2)', 
        [transaction_id, amount]);
      return res.json({ message: 'Transaction sent for admin approval' });
    } else {
      // Auto-approve small transactions
      return res.json({ message: 'Transaction approved automatically' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: Admin Response Handler (e.g., from Twilio webhook)
app.post('/admin-response', async (req, res) => {
  const { Body, From } = req.body; // Assuming Twilio webhook payload
  if (From !== ADMIN_PHONE) return res.status(403).send('Unauthorized');

  const response = Body.toLowerCase();
  // Parse transaction_id from message (simplified - in real, parse properly)
  const transaction_id = 'example_id'; // TODO: Implement parsing

  if (response === 'بله') {
    await pool.query('UPDATE verifications SET status = $1 WHERE transaction_id = $2', 
      ['approved', transaction_id]);
    res.send('Transaction approved');
  } else {
    await pool.query('UPDATE verifications SET status = $1 WHERE transaction_id = $2', 
      ['rejected', transaction_id]);
    res.send('Transaction rejected');
  }
});

// TODO: Add more endpoints for n8n integration, TikTok, etc.

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
