import pool from '../config/db.js';

const migrate = async () => {
    try {
        console.log('🔄 Adding is_published column to exams table...');
        await pool.query(`
            ALTER TABLE exams 
            ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
        `);
        console.log('✅ Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrate();
