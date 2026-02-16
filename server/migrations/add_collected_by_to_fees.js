import pool from '../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
    try {
        console.log('Starting migration: Adding collected_by column...');
        
        await pool.query(`
            ALTER TABLE student_monthly_fees 
            ADD COLUMN IF NOT EXISTS collected_by VARCHAR(255);
        `);
        console.log('✅ Added collected_by to student_monthly_fees');

        await pool.query(`
            ALTER TABLE student_occasional_fees 
            ADD COLUMN IF NOT EXISTS collected_by VARCHAR(255);
        `);
        console.log('✅ Added collected_by to student_occasional_fees');

        console.log('🚀 Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
