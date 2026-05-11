const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FREE_LIMIT = 10;

function sbFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages, userId } = req.body || {};
  if (!messages || !userId) return res.status(400).json({ error: 'Invalid request' });

  // Получаем пользователя
  let user = null;
  const selectRes = await sbFetch(`users?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  const selectData = await selectRes.json();
  if (Array.isArray(selectData) && selectData.length > 0) {
    user = selectData[0];
  } else {
    // Новый пользователь
    const insertRes = await sbFetch('users', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        messages_used: 0,
        is_premium: false,
        created_at: new Date().toISOString()
      })
    });
    const inserted = await insertRes.json();
    user = Array.isArray(inserted) ? inserted[0] : inserted;
  }

  const isPremium = user?.is_premium;
  const messagesUsed = user?.messages_used || 0;

  if (!isPremium && messagesUsed >= FREE_LIMIT) {
    return res.status(402).json({ error: 'limit_reached', messagesUsed, limit: FREE_LIMIT });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: system || '',
        messages
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    // Увеличиваем счётчик
    await sbFetch(`users?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ messages_used: messagesUsed + 1 })
    });

    return res.status(200).json({
      ...data,
      usage_info: {
        messagesUsed: messagesUsed + 1,
        limit: FREE_LIMIT,
        isPremium
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
