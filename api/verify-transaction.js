import mysql from "mysql2/promise";

export default async function handler(req, res) {
  try {
    const conn = await mysql.createConnection({
      host: "195.226.223.11",
      user: "citydigi",
      password: "City@Digii2025",
      database: "citydigi_db",
      connectTimeout: 10000
    });

    const [rows] = await conn.query("SELECT 1 + 1 AS result");
    await conn.end();

    res.status(200).json({ ok: true, result: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
