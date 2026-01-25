-- Quick migration: Add wallet_address to users table
-- Run this SQL directly in your database if you need to add the field immediately

-- Add wallet_address column to users table (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

-- Add channel_owner_wallet_address column to deals table (if not exists)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS channel_owner_wallet_address VARCHAR(255);

-- Verify columns were added
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'wallet_address';

SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'deals' 
AND column_name = 'channel_owner_wallet_address';
