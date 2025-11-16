import mysql from "mysql2/promise";

export default function handler(req, res) {
  res.status(200).json({ message: "API working!" });
}


  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "195.226.223.11",
      user: process.env.MYSQL_USER || "citydigi",
      password: process.env.MYSQL_PASSWORD || "City@Digii2025",
      database: process.env.MYSQL_DATABASE || "citydigi_db"
    });

    const [rows] = await connection.execute("SELECT 1 AS test");
    await connection.end();

    res.status(200).json({ ok: true, mysql: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
