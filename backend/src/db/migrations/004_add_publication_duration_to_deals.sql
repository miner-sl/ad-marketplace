-- Migration: Add first_publication_time and min_publication_duration_days fields to deals table
-- Date: 2026-01-28
-- Description: Adds fields to track when post was first published and minimum duration it must remain published

-- Add first_publication_time column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'deals' 
        AND column_name = 'first_publication_time'
    ) THEN
        ALTER TABLE deals 
        ADD COLUMN first_publication_time TIMESTAMP;
        
        RAISE NOTICE 'Column first_publication_time added to deals table';
    ELSE
        RAISE NOTICE 'Column first_publication_time already exists in deals table';
    END IF;
END $$;

-- Add min_publication_duration_days column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'deals' 
        AND column_name = 'min_publication_duration_days'
    ) THEN
        ALTER TABLE deals 
        ADD COLUMN min_publication_duration_days INTEGER DEFAULT 7 NOT NULL;
        
        RAISE NOTICE 'Column min_publication_duration_days added to deals table';
    ELSE
        RAISE NOTICE 'Column min_publication_duration_days already exists in deals table';
    END IF;
END $$;
