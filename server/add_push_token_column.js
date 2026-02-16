import dotenv from 'dotenv';
dotenv.config();
import pool from './config/db.js';

const addPushTokenColumn = async () => {
    try {
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);
        `);
        console.log('✅ push_token column added to students table');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

addPushTokenColumn();
