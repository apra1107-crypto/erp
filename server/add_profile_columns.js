import pool from './config/db.js';

const runMigration = async () => {
    try {
        await pool.query("ALTER TABLE institutes ADD COLUMN IF NOT EXISTS logo_url TEXT;");
        await pool.query("ALTER TABLE institutes ADD COLUMN IF NOT EXISTS principal_photo_url TEXT;");
        console.log('✅ Columns added successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
