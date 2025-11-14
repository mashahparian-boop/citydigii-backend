// --- اصلاح کامل برای محیط Serverless Vercel ---
const express = require('express');
const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---- بخش verify با Eitaayar ----
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    await pool.query('INSERT INTO logs(action, details) VALUES($1,$2)', [
      'verify_transaction',
      { transaction_id, amount },
    ]);

    const adminMsg = `📩 تراکنش جدید برای بررسی:\n💳 شناسه: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
    await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.EITAAYAR_PERSONAL,
        text: adminMsg,
        title: 'بررسی تراکنش',
      }),
    });

    if (amount <= 20000000) {
      const publicMsg = `✅ تراکنش تایید شد:\n💳 شناسه: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
      await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.EITAAYAR_CHANNEL,
          text: publicMsg,
          title: 'اعلان تایید تراکنش',
        }),
      });
    }

    res.json({ message: 'Sent successfully ✔️' });
  } catch (err) {
    console.error('❌ Error verifying transaction:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 🚫 نکته حیاتی برای Serverless:
module.exports = app;
