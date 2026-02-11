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
        AND column_name = 'decline_reason'
    ) THEN
        ALTER TABLE deals
        ADD COLUMN decline_reason VARCHAR(255);

        RAISE NOTICE 'Column decline_reason added to deals table';
    ELSE
        RAISE NOTICE 'Column decline_reason already exists in deals table';
    END IF;
END $$;
