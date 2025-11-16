   import mysql from 'mysql2/promise';

export default function handler(req, res) {
  if (req.method === 'POST') {
    res.status(200).json({ message: 'Transaction verified and logged.' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

     try {
       const pool = mysql.createPool({
         host: process.env.MYSQL_HOST,
         user: process.env.MYSQL_USER,
         password: process.env.MYSQL_PASSWORD,
         database: process.env.MYSQL_DATABASE,
       });

       const { userId, amount, refId } = req.body;
       await pool.query(
         'INSERT INTO logs (action, details) VALUES (?, ?)',
         ['transaction_verified', JSON.stringify({ userId, amount, refId })]
       );

       res.status(200).json({ ok: true, message: 'Transaction verified and logged.' });
     } catch (error) {
       res.status(500).json({ ok: false, error: error.message });
     }
   }
