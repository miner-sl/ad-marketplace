-- Migration: Add topics table and topic_id to channels
-- Date: 2026-02-02
-- Description: Creates topics table and adds topic_id foreign key to channels table

-- Create topics table if it doesn't exist
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add topic_id column to channels table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'channels'
        AND column_name = 'topic_id'
    ) THEN
        ALTER TABLE channels ADD COLUMN topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_channels_topic_id ON channels(topic_id);

        RAISE NOTICE 'Column topic_id added to channels table';
    ELSE
        RAISE NOTICE 'Column topic_id already exists in channels table';
    END IF;
END $$;
