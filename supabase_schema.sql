-- Запусти это в Supabase SQL Editor один раз

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  messages_used INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска
CREATE INDEX idx_users_user_id ON users(user_id);

-- Отключаем RLS (используем service key на бэкенде)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
