import pool from './config/db.js';

const migrate = async () => {
    try {
        console.log('Starting migration to add receipt details columns...');

        // 1. Add columns to student_fees
        await pool.query(`
            ALTER TABLE student_fees 
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash',
            ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS collected_by VARCHAR(100)
        `);
        console.log('Added columns to student_fees');

        // 2. Add columns to one_time_fee_payments
        await pool.query(`
            ALTER TABLE one_time_fee_payments 
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash',
            ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS collected_by VARCHAR(100)
        `);
        console.log('Added columns to one_time_fee_payments');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();