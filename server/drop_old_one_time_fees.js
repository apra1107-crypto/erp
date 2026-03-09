import pool from './config/db.js';

async function dropOldOneTimeFeeTables() {
    try {
        console.log('Dropping old one-time fee tables...');
        await pool.query('DROP TABLE IF EXISTS one_time_fee_payments CASCADE');
        await pool.query('DROP TABLE IF EXISTS one_time_fee_groups CASCADE');
        console.log('✅ Old one-time fee tables dropped successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error dropping tables:', error);
        process.exit(1);
    }
}

dropOldOneTimeFeeTables();
