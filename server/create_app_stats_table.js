import pool from './config/db.js';

async function createAppStatsTable() {
    try {
        // Create table for general app statistics
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_stats (
                id SERIAL PRIMARY KEY,
                stat_name VARCHAR(50) UNIQUE NOT NULL,
                stat_value INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Initialize download_count if it doesn't exist
        await pool.query(`
            INSERT INTO app_stats (stat_name, stat_value)
            VALUES ('download_count', 0)
            ON CONFLICT (stat_name) DO NOTHING;
        `);

        console.log('✅ App stats table created and initialized successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating app stats table:', error);
        process.exit(1);
    }
}

createAppStatsTable();