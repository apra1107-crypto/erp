import pool from './config/db.js';

async function migrate() {
    console.log('--- Starting Notices and Calendar Session Migration ---');

    try {
        // 1. Add session_id column to notices
        console.log('Adding session_id to notices...');
        await pool.query(`
            ALTER TABLE notices 
            ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE
        `);

        // 2. Add session_id column to academic_calendar
        console.log('Adding session_id to academic_calendar...');
        await pool.query(`
            ALTER TABLE academic_calendar 
            ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE
        `);

        // 3. Populate existing records with institute's current_session_id
        console.log('Populating existing records with current session ID...');
        const institutesRes = await pool.query('SELECT id, current_session_id FROM institutes');
        
        for (const inst of institutesRes.rows) {
            if (inst.current_session_id) {
                // Update notices
                await pool.query(
                    'UPDATE notices SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                    [inst.current_session_id, inst.id]
                );
                // Update academic_calendar
                await pool.query(
                    'UPDATE academic_calendar SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                    [inst.current_session_id, inst.id]
                );
            }
        }

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
