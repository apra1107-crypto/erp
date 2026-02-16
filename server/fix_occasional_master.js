import pool from './config/db.js';

const fixOccasionalMaster = async () => {
    try {
        console.log('⚡ Fixing occasional_fee_master...');
        
        // 1. Add session_id column
        await pool.query(`ALTER TABLE occasional_fee_master ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id)`);
        console.log('✅ Added session_id column to occasional_fee_master');

        // 2. Set default session_id for existing rows
        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');
        for (const inst of institutes.rows) {
            if (inst.current_session_id) {
                await pool.query(
                    'UPDATE occasional_fee_master SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                    [inst.current_session_id, inst.id]
                );
            }
        }
        console.log('✅ Migrated existing data in occasional_fee_master');

        // 3. Add Unique Constraint
        await pool.query(`ALTER TABLE occasional_fee_master ADD UNIQUE (institute_id, fee_name, session_id)`);
        console.log('✅ Added session-aware unique constraint to occasional_fee_master');

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to fix occasional_fee_master:', err);
        process.exit(1);
    }
};

fixOccasionalMaster();
