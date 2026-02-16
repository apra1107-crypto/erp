import pool from './config/db.js';

const checkData = async () => {
    try {
        const res = await pool.query('SELECT count(*) FROM institutes');
        console.log('Institute Count:', res.rows[0].count);

        const resData = await pool.query('SELECT id, institute_name FROM institutes LIMIT 5');
        console.log('Sample Institutes:', resData.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

checkData();
