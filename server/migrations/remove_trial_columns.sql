-- Migration: Remove trial period columns from subscription_settings table
-- Run this SQL script directly in your PostgreSQL database

ALTER TABLE subscription_settings 
DROP COLUMN IF EXISTS trial_days,
DROP COLUMN IF EXISTS trial_end_date;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscription_settings';
