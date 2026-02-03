-- Migration: Add user authentication fields for Telegram auth
-- Date: 2026-02-02
-- Description: Adds photo_url, language_code, and is_premium fields to users table for Telegram authentication

-- Add photo_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN photo_url VARCHAR(500);
        
        RAISE NOTICE 'Column photo_url added to users table';
    ELSE
        RAISE NOTICE 'Column photo_url already exists in users table';
    END IF;
END $$;

-- Add language_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'language_code'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN language_code VARCHAR(10);
        
        RAISE NOTICE 'Column language_code added to users table';
    ELSE
        RAISE NOTICE 'Column language_code already exists in users table';
    END IF;
END $$;

-- Add is_premium column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'is_premium'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column is_premium added to users table';
    ELSE
        RAISE NOTICE 'Column is_premium already exists in users table';
    END IF;
END $$;
