-- Clear all payment history and reset subscription data for fresh testing
-- WARNING: This will delete all payment logs and reset subscription settings

-- Step 1: Clear all subscription logs (payment history)
DELETE FROM subscription_logs;

-- Step 2: Reset all subscription settings to default state
UPDATE subscription_settings 
SET 
    subscription_end_date = NULL,
    last_payment_date = NULL,
    is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP;

-- Step 3: Verify the cleanup
SELECT 'Subscription Logs Count' as info, COUNT(*) as count FROM subscription_logs
UNION ALL
SELECT 'Active Subscriptions' as info, COUNT(*) as count FROM subscription_settings WHERE is_active = TRUE
UNION ALL
SELECT 'Total Subscription Settings' as info, COUNT(*) as count FROM subscription_settings;

-- Optional: If you want to completely remove subscription_settings and start fresh
-- TRUNCATE TABLE subscription_settings CASCADE;
-- TRUNCATE TABLE subscription_logs CASCADE;

SELECT '✅ Payment history cleared successfully!' as status;
