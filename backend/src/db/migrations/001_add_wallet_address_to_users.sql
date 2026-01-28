-- Migration: Add wallet_address field to users table
-- Date: 2026-01-25
-- Description: Adds TON wallet address field for users to receive payments

-- Add wallet_address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'wallet_address'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN wallet_address VARCHAR(255);
        
        RAISE NOTICE 'Column wallet_address added to users table';
    ELSE
        RAISE NOTICE 'Column wallet_address already exists in users table';
    END IF;
END $$;
