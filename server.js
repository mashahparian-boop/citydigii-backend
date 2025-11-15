import express from "express";
import axios from "axios";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// اتصال امن به دیتابیس MySQL جومینا
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "citydigi_user",
  password: process.env.DB_PASS || "City@Digii2025",
  database: process.env.DB_NAME || "citydigi_db",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

// تست وضعیت سرور و مسیر اصلی
app.get("/", (req, res) => {
  res.send("✅ CityDigii Backend is running successfully.");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// مسیر بررسی و ثبت تراکنش
app.post("/verify-transaction", async (req, res) => {
  try {
    const { userId, amount, refId } = req.body;
    if (!userId || !amount || !refId)
      return res.status(400).json({ error: "Missing required fields" });

    // ثبت در جدول logs
    const insertQuery = "INSERT INTO logs (userId, amount, refId) VALUES (?, ?, ?)";
    await pool.execute(insertQuery, [userId, amount, refId]);

    // ارسال پیام تأیید به ایتایار
    const eitaApi = `https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`;
    const message = `💳 تراکنش تأیید شد\nشناسه: ${refId}\nمبلغ: ${amount}\nکاربر: ${userId}`;

    await axios.post(eitaApi, {
      chat_id: process.env.EITAAYAR_CHANNEL,
      text: message
    });

    res.status(200).json({ message: "Sent successfully ✔️" });
  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// خروجی ماژول برای Vercel
export default app;
