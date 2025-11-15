// --- نسخه نهایی CityDigii Backend برای محیط Serverless Vercel ---
import express from "express";
import mysql from "mysql2/promise";
import axios from "axios";

const app = express();
app.use(express.json());

// ✅ اتصال به MySQL جومینا – از Env Vars در Vercel استفاده کن
const pool = mysql.createPool({
  host: "localhost",
  user: "citydigi_user",
  password: "CityDigi120296",
  database: "citydigi_db",
});

// 🧩 مسیر favicon
app.get("/favicon.ico", (_, res) => res.status(204).end());

// --- مسیر ریشه ---
app.get("/", (_, res) => {
  res.send("🚀 CityDigii backend (Eitaayar integration) is running successfully!");
});

// --- Health Check ---
app.get("/health", (_, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --- مسیر verify ---
app.post("/verify-transaction", async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // ثبت در دیتابیس
    await pool.query("INSERT INTO logs(action, details) VALUES(?, ?)", [
      "verify_transaction",
      JSON.stringify({ transaction_id, amount }),
    ]);

    // پیام مدیر (شخصی)
    const adminMsg = `📩 تراکنش جدید:\n💳 ID: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
    await axios.post(
      `https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`,
      {
        chat_id: process.env.EITAAYAR_PERSONAL,
        text: adminMsg,
        title: "بررسی تراکنش",
      }
    );

    // پیام عمومی کانال
    if (amount <= 20000000) {
      const publicMsg = `✅ تراکنش تایید شد:\n💳 ID: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
      await axios.post(
        `https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`,
        {
          chat_id: process.env.EITAAYAR_CHANNEL,
          text: publicMsg,
          title: "اعلان تایید تراکنش",
        }
      );
    }

    res.json({ message: "Sent successfully ✔️" });
  } catch (err) {
    console.error("❌ Error verifying transaction:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🚫 لازم فقط در Vercel export app
export default app;
