import pool from './config/db.js';

const test = async () => {
    try {
        const id = 2; // Heritage academy high school
        const result = await pool.query(
            `SELECT 
                i.*, 
                ss.trial_end_date, ss.subscription_end_date,
                CASE 
                    WHEN i.is_active = FALSE THEN 'Disabled'
                    WHEN ss.is_active = FALSE THEN 'Disabled'
                    WHEN ss.subscription_end_date >= CURRENT_DATE THEN 'Active'
                    WHEN ss.trial_end_date >= CURRENT_DATE THEN 'Trial'
                    WHEN ss.trial_end_date IS NULL AND ss.subscription_end_date IS NULL THEN 'Inactive'
                    ELSE 'Expired'
                END as current_status
            FROM institutes i 
            LEFT JOIN subscription_settings ss ON ss.institute_id = i.id
            WHERE i.id = $1`,
            [id]
        );
        console.log('Query successful, rows:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('First row keys:', Object.keys(result.rows[0]));
            console.log('Status:', result.rows[0].current_status);
        }
    } catch (err) {
        console.error('Query failed:', err.message);
    } finally {
        process.exit();
    }
};

test();
