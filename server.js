import express from "express";
import axios from "axios";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// اتصال به دیتابیس MySQL هاست جومینا
const pool = mysql.createPool({
  host: "localhost",
  user: "citydigi_user",
  password: "City@Digii2025",
  database: "citydigi_db"
});

// تست وضعیت سرور
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// مسیر اصلی برای بررسی تراکنش
app.post("/verify-transaction", async (req, res) => {
  try {
    const { userId, amount, refId } = req.body;
    if (!userId || !amount || !refId)
      return res.status(400).json({ error: "Missing fields" });

    // ثبت لاگ در MySQL
    const sql = "INSERT INTO logs (userId, amount, refId) VALUES (?, ?, ?)";
    await pool.query(sql, [userId, amount, refId]);

    // ارسال پیام به ایتا
    const eitaUrl = `https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`;
    const msg = `✅ تراکنش تأیید شد\nشناسه: ${refId}\nمبلغ: ${amount}\nکاربر: ${userId}`;
    await axios.post(eitaUrl, {
      chat_id: process.env.EITAAYAR_CHANNEL,
      text: msg
    });

    res.status(200).json({ message: "Sent successfully ✔️" });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// اجرا در محیط Vercel
export default app;
