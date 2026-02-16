import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const updateOccasionalFeesTable = async () => {
    try {
        await pool.query(`
            ALTER TABLE student_occasional_fees 
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unpaid',
            ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
        `);
        console.log('✅ Occasional Fees table updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating table:', error);
        process.exit(1);
    }
};

updateOccasionalFeesTable();
