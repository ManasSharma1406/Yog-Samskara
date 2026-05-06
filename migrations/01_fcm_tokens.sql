-- Migration: Create FCM Tokens Table (Postgres)
-- Note: The application uses Sequelize to auto-sync models, so this file is mainly for reference
-- or manual execution on a raw Postgres database. SQLite uses a different syntax.

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL, -- using VARCHAR since Firebase UID is a string
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
