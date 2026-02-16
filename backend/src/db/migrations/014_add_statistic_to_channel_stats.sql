-- Add statistic JSONB column to channel_stats for storing full Telegram stats response
ALTER TABLE channel_stats
  ADD COLUMN IF NOT EXISTS statistic JSONB;

COMMENT ON COLUMN channel_stats.statistic IS 'Full Telegram channel/group stats JSON (e.g. from stats.GetBroadcastStats / GetMegagroupStats)';
