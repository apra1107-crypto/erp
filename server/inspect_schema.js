import pool from './config/db.js';

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('teachers', 'institutes', 'students')
            AND column_name IN ('id', 'teacher_id', 'institute_id', 'student_id', 'session_id');
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
