-- Add country and locale to channels
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS country VARCHAR(255),
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10);


CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users(username)
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_username_unique
  ON channels(username)
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_telegram_channel_id_unique
  ON channels(telegram_channel_id)
  WHERE telegram_channel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique
  ON users(telegram_id)
  WHERE telegram_id IS NOT NULL;
