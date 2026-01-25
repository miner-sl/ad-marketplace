-- Migration: Add channel_owner_wallet_address field to deals table
-- Date: 2026-01-25
-- Description: Adds channel owner wallet address field for escrow fund release

-- Add channel_owner_wallet_address column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'deals' 
        AND column_name = 'channel_owner_wallet_address'
    ) THEN
        ALTER TABLE deals 
        ADD COLUMN channel_owner_wallet_address VARCHAR(255);
        
        RAISE NOTICE 'Column channel_owner_wallet_address added to deals table';
    ELSE
        RAISE NOTICE 'Column channel_owner_wallet_address already exists in deals table';
    END IF;
END $$;
