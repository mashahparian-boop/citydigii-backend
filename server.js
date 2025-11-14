// --- CityDigii Backend (Serverless on Vercel) ---
import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

// ایجاد pool برای PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// --- مسیر favicon برای جلوگیری از 404 ---
app.get('/favicon.ico', (_, res) => res.status(204).end());

// --- مسیر ریشه اصلی ---
app.get('/', (_, res) => {
  res.send('🚀 CityDigii backend (Eitaayar integration) is running successfully!');
});

// --- Health Check برای Vercel Monitor ---
app.get('/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- مسیر اصلی verify-transaction ---
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // ثبت لاگ در دیتابیس PostgreSQL
    await pool.query('INSERT INTO logs(action, details) VALUES($1,$2)', [
      'verify_transaction',
      JSON.stringify({ transaction_id, amount }),
    ]);

    // پیام برای اکانت شخصی ادمین
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

    // پیام عمومی فقط برای تراکنش‌های زیر ۲۰ میلیون
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

// خروج نهایی برای Serverless
export default app;
