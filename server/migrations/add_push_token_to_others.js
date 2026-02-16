import dotenv from 'dotenv';
dotenv.config();
import pool from '../config/db.js';

const migrate = async () => {
    try {
        console.log('Starting migration to add push_token columns...');
        
        await pool.query(`
            ALTER TABLE teachers 
            ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);
        `);
        console.log('✅ push_token column added to teachers table');

        await pool.query(`
            ALTER TABLE institutes 
            ADD COLUMN IF NOT EXISTS push_token VARCHAR(255);
        `);
        console.log('✅ push_token column added to institutes table');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrate();
