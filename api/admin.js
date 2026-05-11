import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Простая защита — секретный ключ
  const { adminKey, userId, action } = req.body || {};
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (action === 'grant_premium') {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // +1 месяц

    const { error } = await supabase
      .from('users')
      .update({
        is_premium: true,
        premium_until: expiresAt.toISOString()
      })
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, userId, premiumUntil: expiresAt });
  }

  if (action === 'revoke_premium') {
    await supabase
      .from('users')
      .update({ is_premium: false, premium_until: null })
      .eq('user_id', userId);
    return res.status(200).json({ success: true });
  }

  if (action === 'list_users') {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    return res.status(200).json({ users: data });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
