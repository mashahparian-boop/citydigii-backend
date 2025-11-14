// --- اصلاح کامل برای محیط Serverless Vercel ---
import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import fetch from 'node-fetch';

// ✅ تعریف pool برای PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(express.json());

// 🧩 مسیر favicon
app.get('/favicon.ico', (_, res) => res.status(204).end());

// --- مسیر ریشه ---
app.get('/', (_, res) => {
  res.send('🚀 CityDigii backend (Eitaayar integration) is running successfully!');
});

// --- Health Check ---
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---- مسیر verify ---
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    await pool.query('INSERT INTO logs(action, details) VALUES($1,$2)', [
      'verify_transaction',
      JSON.stringify({ transaction_id, amount })
    ]);

    const adminMsg = `📩 تراکنش جدید:\n💳 ID: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
    await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.EITAAYAR_PERSONAL,
        text: adminMsg,
        title: 'بررسی تراکنش'
      })
    });

    if (amount <= 20000000) {
      const publicMsg = `✅ تراکنش تایید شد:\n💳 ID: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
      await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.EITAAYAR_CHANNEL,
          text: publicMsg,
          title: 'اعلان تایید تراکنش'
        })
      });
    }

    res.json({ message: 'Sent successfully ✔️' });
  } catch (err) {
    console.error('❌ Error verifying transaction:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 🚫 فقط در Vercel export باید این باشه
export default app;
