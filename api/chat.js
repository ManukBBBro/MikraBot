import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FREE_LIMIT = 10; // бесплатных сообщений

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, messages, userId } = req.body || {};
  if (!messages || !userId) return res.status(400).json({ error: 'Invalid request' });

  // Получаем или создаём пользователя
  let { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !user) {
    // Новый пользователь
    const { data: newUser } = await supabase
      .from('users')
      .insert([{
        user_id: userId,
        messages_used: 0,
        is_premium: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    user = newUser;
  }

  // Проверяем подписку и лимит
  const isPremium = user?.is_premium;
  const messagesUsed = user?.messages_used || 0;

  if (!isPremium && messagesUsed >= FREE_LIMIT) {
    return res.status(402).json({
      error: 'limit_reached',
      messagesUsed,
      limit: FREE_LIMIT
    });
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
    await supabase
      .from('users')
      .update({ messages_used: messagesUsed + 1 })
      .eq('user_id', userId);

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
