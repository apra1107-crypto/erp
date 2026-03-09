import pool from './config/db.js';

const addSessionIdToBuses = async () => {
    try {
        console.log('Adding session_id to buses table...');
        
        // 1. Add session_id column (nullable first to handle existing data if any)
        await pool.query(`
            ALTER TABLE buses 
            ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE
        `);
        console.log('✅ session_id column added');

        // 2. Try to backfill session_id for existing buses if they belong to an institute
        // We can use the current active session for the institute
        await pool.query(`
            UPDATE buses b
            SET session_id = (
                SELECT id FROM academic_sessions 
                WHERE institute_id = b.institute_id AND is_active = true 
                LIMIT 1
            )
            WHERE session_id IS NULL
        `);
        console.log('✅ Backfilled session_id for existing buses using active sessions');

    } catch (error) {
        console.error('❌ Error updating buses table:', error);
    } finally {
        process.exit();
    }
};

addSessionIdToBuses();
