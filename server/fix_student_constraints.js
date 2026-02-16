import pool from './config/db.js';

const fixStudentConstraints = async () => {
    try {
        console.log('⚡ Updating student unique constraints...');
        
        // 1. Fix unique_code
        const codeRes = await pool.query(`
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'students'::regclass AND pg_get_constraintdef(oid) LIKE '%unique_code%'
        `);
        if (codeRes.rows.length > 0) {
            for (const row of codeRes.rows) {
                await pool.query(`ALTER TABLE students DROP CONSTRAINT ${row.conname}`);
            }
            console.log('✅ Dropped old unique_code constraints');
        }
        await pool.query(`ALTER TABLE students ADD UNIQUE (unique_code, session_id)`);
        console.log('✅ Added new (unique_code, session_id) constraint');

        // 2. Fix roll_no
        const rollRes = await pool.query(`
            SELECT conname FROM pg_constraint 
            WHERE conrelid = 'students'::regclass AND pg_get_constraintdef(oid) LIKE '%roll_no%'
        `);
        if (rollRes.rows.length > 0) {
            for (const row of rollRes.rows) {
                await pool.query(`ALTER TABLE students DROP CONSTRAINT ${row.conname}`);
            }
            console.log('✅ Dropped old roll_no constraints');
        }
        await pool.query(`ALTER TABLE students ADD UNIQUE (institute_id, roll_no, class, section, session_id)`);
        console.log('✅ Added new (institute_id, roll_no, class, section, session_id) constraint');

        console.log('🎉 Done!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

fixStudentConstraints();