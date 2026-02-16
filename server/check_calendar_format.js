import pool from './config/db.js';

const checkFormat = async () => {
    try {
        const result = await pool.query('SELECT event_date FROM academic_calendar LIMIT 3');
        console.log('Raw result rows:');
        console.log(result.rows);
        
        if (result.rows.length > 0) {
            const firstDate = result.rows[0].event_date;
            console.log('Type of event_date:', typeof firstDate);
            console.log('String representation:', String(firstDate));
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkFormat();
