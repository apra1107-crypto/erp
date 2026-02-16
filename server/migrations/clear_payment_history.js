import db from '../config/db.js';

const clearPaymentHistory = async () => {
    try {
        console.log('🧹 Starting payment history cleanup...\n');

        // Step 1: Clear all subscription logs
        const logsResult = await db.query('DELETE FROM subscription_logs RETURNING *');
        console.log(`✅ Deleted ${logsResult.rowCount} payment log entries`);

        // Step 2: Reset all subscription settings
        const resetQuery = `
            UPDATE subscription_settings 
            SET 
                subscription_end_date = NULL,
                last_payment_date = NULL,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;
        const resetResult = await db.query(resetQuery);
        console.log(`✅ Reset ${resetResult.rowCount} subscription settings to default state`);

        // Step 3: Verify cleanup
        const verifyQuery = `
            SELECT 
                (SELECT COUNT(*) FROM subscription_logs) as logs_count,
                (SELECT COUNT(*) FROM subscription_settings WHERE subscription_end_date >= CURRENT_TIMESTAMP) as active_count,
                (SELECT COUNT(*) FROM subscription_settings) as total_settings
        `;
        const verifyResult = await db.query(verifyQuery);
        const stats = verifyResult.rows[0];

        console.log('\n📊 Cleanup Summary:');
        console.log(`   - Subscription Logs: ${stats.logs_count}`);
        console.log(`   - Active Subscriptions: ${stats.active_count}`);
        console.log(`   - Total Settings: ${stats.total_settings}`);

        console.log('\n✨ Payment history cleared successfully!');
        console.log('🎯 System is ready for fresh testing\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing payment history:', error);
        process.exit(1);
    }
};

clearPaymentHistory();
