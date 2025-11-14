// ✅ Transaction Verification (using Eitaayar API)
app.post('/verify-transaction', async (req, res) => {
  const { transaction_id, amount } = req.body;
  if (!transaction_id || !amount)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Log action
    await pool.query(
      'INSERT INTO logs (action, details) VALUES ($1, $2)',
      ['verify_transaction', { transaction_id, amount }]
    );

    // Send message to personal Eita account for admin review
    const adminMsg = `📩 تراکنش جدید برای بررسی:\n💳 شناسه: ${transaction_id}\n💰 مبلغ: ${amount} تومان\n⏳ لطفاً جهت تأیید اقدام فرمایید.`;
    await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.EITAAYAR_PERSONAL,
        text: adminMsg,
        title: 'درخواست بررسی تراکنش'
      })
    });

    // اگر تراکنش زیر حد تعیین شده بود → به‌طور خودکار تأیید و به کانال ارسال شود
    if (amount <= 20000000) {
      const publicMsg = `✅ تراکنش تایید شد:\n💳 شناسه: ${transaction_id}\n💰 مبلغ: ${amount} تومان`;
      await fetch(`https://eitaayar.ir/api/${process.env.EITAAYAR_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.EITAAYAR_CHANNEL,
          text: publicMsg,
          title: 'اعلان تراکنش تایید شده'
        })
      });
    }

    await pool.query(
      'INSERT INTO verifications (transaction_id, amount) VALUES ($1, $2)',
      [transaction_id, amount]
    );

    return res.json({ message: 'Message sent to admin (and maybe channel) ✅' });

  } catch (err) {
    console.error('❌ Error verifying transaction:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
