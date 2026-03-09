import pool from './config/db.js';

const run = async () => {
    try {
        await pool.query('ALTER TABLE admit_cards ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false');
        console.log('Migration successful');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed', e);
        process.exit(1);
    }
};
run();