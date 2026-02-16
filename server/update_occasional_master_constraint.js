import pool from './config/db.js';

const updateOccasionalMasterConstraint = async () => {
    try {
        console.log('⚡ Updating occasional_fee_master UNIQUE constraint...');
        
        const nameQuery = await pool.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'occasional_fee_master'::regclass AND contype = 'u';
        `);

        if (nameQuery.rows.length > 0) {
            for (const row of nameQuery.rows) {
                await pool.query(`ALTER TABLE occasional_fee_master DROP CONSTRAINT ${row.conname}`);
                console.log(`✅ Dropped old constraint: ${row.conname}`);
            }
        }

        await pool.query(`
            ALTER TABLE occasional_fee_master 
            ADD UNIQUE (institute_id, fee_name, session_id)
        `);
        console.log('✅ Added new session-aware unique constraint to occasional_fee_master');

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to update constraint:', err);
        process.exit(1);
    }
};

updateOccasionalMasterConstraint();
