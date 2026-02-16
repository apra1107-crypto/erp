-- Migration: Remove is_active column from subscription_settings
-- The system now relies purely on subscription_end_date for status calculation

ALTER TABLE subscription_settings 
DROP COLUMN IF EXISTS is_active;

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscription_settings';
