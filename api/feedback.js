export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, text, rating, userId } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No feedback text' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'Email not configured' });

  const stars = '⭐'.repeat(rating || 0) || 'не указано';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:12px;padding:24px">
      <h2 style="color:#4F8EF7;margin-bottom:4px">📬 Новый фидбек — МикроБот</h2>
      <hr style="border:none;border-top:1px solid #eee;margin:12px 0">
      <p><b>Имя:</b> ${name || 'Аноним'}</p>
      <p><b>Оценка:</b> ${stars}</p>
      <p><b>ID пользователя:</b> <code>${userId || 'неизвестен'}</code></p>
      <p><b>Сообщение:</b></p>
      <div style="background:#fff;border-left:4px solid #4F8EF7;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:8px">
        ${text.replace(/\n/g, '<br>')}
      </div>
      <p style="color:#999;font-size:12px;margin-top:20px">Отправлено: ${new Date().toLocaleString('ru-RU')}</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'МикроБот <onboarding@resend.dev>',
        to: ['charmanadv@gmail.com'],
        subject: `📬 Фидбек от ${name || 'пользователя'} — МикроБот`,
        html
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
