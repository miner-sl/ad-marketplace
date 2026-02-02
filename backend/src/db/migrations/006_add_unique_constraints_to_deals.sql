-- Migration: Add unique constraints to prevent duplicate operations
-- Date: 2026-02-02
-- Description: Adds unique partial indexes to prevent duplicate payment confirmations and post publications
--              These constraints only apply when the values are NOT NULL, allowing multiple NULL values

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'deals' 
        AND indexname = 'idx_deals_unique_payment_tx_hash'
    ) THEN
        CREATE UNIQUE INDEX idx_deals_unique_payment_tx_hash 
        ON deals(id, payment_tx_hash)
        WHERE payment_tx_hash IS NOT NULL;
        
        RAISE NOTICE 'Unique index idx_deals_unique_payment_tx_hash created';
    ELSE
        RAISE NOTICE 'Unique index idx_deals_unique_payment_tx_hash already exists';
    END IF;
END $$;

-- Add unique partial index for (deal_id, post_message_id)
-- This prevents duplicate post publications for the same deal
-- (idempotency protection - since deal_id is already unique, this mainly prevents reusing same message_id)
-- Only applies when post_message_id IS NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'deals' 
        AND indexname = 'idx_deals_unique_post_message_id'
    ) THEN
        CREATE UNIQUE INDEX idx_deals_unique_post_message_id 
        ON deals(id, post_message_id)
        WHERE post_message_id IS NOT NULL;
        
        RAISE NOTICE 'Unique index idx_deals_unique_post_message_id created';
    ELSE
        RAISE NOTICE 'Unique index idx_deals_unique_post_message_id already exists';
    END IF;
END $$;
