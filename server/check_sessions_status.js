import pool from './config/db.js';

const checkSessions = async () => {
    try {
        const result = await pool.query('SELECT id, institute_name, current_session_id FROM institutes');
        console.log('Institutes and their Current Sessions:');
        console.table(result.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkSessions();
