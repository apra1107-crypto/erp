import pool from './config/db.js';

const updateAttendanceConstraint = async () => {
    try {
        console.log('⚡ Updating attendance UNIQUE constraint...');
        
        // Find existing unique constraint on student_id and date
        const nameQuery = await pool.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'attendance'::regclass AND contype = 'u';
        `);

        if (nameQuery.rows.length > 0) {
            const constraintName = nameQuery.rows[0].conname;
            await pool.query(`ALTER TABLE attendance DROP CONSTRAINT ${constraintName}`);
            console.log(`✅ Dropped old constraint: ${constraintName}`);
        }

        // Add the new one including session_id
        await pool.query(`
            ALTER TABLE attendance 
            ADD UNIQUE (student_id, date, session_id)
        `);
        console.log('✅ Added new session-aware unique constraint to attendance');

        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to update attendance constraint:', err);
        process.exit(1);
    }
};

updateAttendanceConstraint();
