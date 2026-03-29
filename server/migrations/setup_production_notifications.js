import pool from '../config/db.js';

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create table for tracking push receipts (Step 2 of Expo flow)
        await client.query(`
            CREATE TABLE IF NOT EXISTS push_notification_receipts (
                id SERIAL PRIMARY KEY,
                ticket_id TEXT UNIQUE NOT NULL,
                push_token TEXT NOT NULL,
                student_id INTEGER,
                status TEXT DEFAULT 'pending', 
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                checked_at TIMESTAMP
            );
        `);

        // 2. Add index for faster cleanup and lookup
        await client.query(`CREATE INDEX IF NOT EXISTS idx_push_receipts_status ON push_notification_receipts(status);`);

        // 3. Add column to attendance_logs to prevent spamming
        await client.query(`
            ALTER TABLE attendance_logs 
            ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP;
        `);

        await client.query('COMMIT');
        console.log('✅ Production notification migration completed');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e);
    } finally {
        client.release();
    }
}

migrate();