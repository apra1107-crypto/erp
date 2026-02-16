import pool from './config/db.js';

const updateConstraint = async () => {
    try {
        console.log('⚡ Updating class_routines UNIQUE constraint...');
        
        // 1. Find the name of the existing unique constraint
        const nameQuery = await pool.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'class_routines'::regclass AND contype = 'u';
        `);

        if (nameQuery.rows.length > 0) {
            const constraintName = nameQuery.rows[0].conname;
            await pool.query(`ALTER TABLE class_routines DROP CONSTRAINT ${constraintName}`);
            console.log(`✅ Dropped old constraint: ${constraintName}`);
        }

        // 2. Add the new one including session_id
        await pool.query(`
            ALTER TABLE class_routines 
            ADD UNIQUE (institute_id, class_name, section, session_id)
        `);
        console.log('✅ Added new session-aware unique constraint to class_routines');

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to update constraint:', err);
        process.exit(1);
    }
};

updateConstraint();
