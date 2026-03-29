import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
    try {
        console.log('🔄 Adding evaluation_mode column to exams table...');
        await pool.query(`
            ALTER TABLE exams 
            ADD COLUMN IF NOT EXISTS evaluation_mode VARCHAR(20) DEFAULT 'senior';
        `);
        console.log('✅ Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrate();
