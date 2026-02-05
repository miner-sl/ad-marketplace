-- Migration: Add refund_tx_hash field to deals table
-- Date: 2026-02-05
-- Description: Adds refund transaction hash field for tracking refunds to advertisers

-- Add refund_tx_hash column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'deals' 
        AND column_name = 'refund_tx_hash'
    ) THEN
        ALTER TABLE deals 
        ADD COLUMN refund_tx_hash VARCHAR(255);
        
        RAISE NOTICE 'Column refund_tx_hash added to deals table';
    ELSE
        RAISE NOTICE 'Column refund_tx_hash already exists in deals table';
    END IF;
END $$;
