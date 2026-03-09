import pool from './config/db.js';

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE admit_cards 
            ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
        `);
        console.log('✅ Added is_published column to admit_cards');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();