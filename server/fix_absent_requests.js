import pool from './config/db.js';

const fixAbsentRequests = async () => {
    try {
        console.log('⚡ Adding missing session_id to absent_requests...');
        
        // 1. Add column
        await pool.query(`ALTER TABLE absent_requests ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id)`);
        console.log('✅ Added session_id column');

        // 2. Migrate existing data
        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');
        for (const inst of institutes.rows) {
            if (inst.current_session_id) {
                const res = await pool.query(
                    'UPDATE absent_requests SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                    [inst.current_session_id, inst.id]
                );
                console.log(`✅ Migrated ${res.rowCount} rows for Institute ${inst.id}`);
            }
        }

        console.log('🎉 Done fixing absent_requests!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed:', err.message);
        process.exit(1);
    }
};

fixAbsentRequests();
