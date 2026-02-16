import pool from './config/db.js';

const testAdminQuery = async () => {
    try {
        console.log('Testing Admin Query (Detailed version)...');
        const result = await pool.query(
            `SELECT 
                i.id, i.institute_name, i.principal_name, i.email, i.mobile, i.district, i.state, 
                i.logo_url, i.principal_photo_url, i.created_at, i.is_active as db_is_active,
                ss.monthly_price, ss.trial_end_date, ss.subscription_end_date,
                CASE 
                    WHEN i.is_active = FALSE THEN 'Disabled'
                    WHEN ss.is_active = FALSE THEN 'Disabled'
                    WHEN ss.trial_end_date >= CURRENT_DATE THEN 'Trial'
                    WHEN ss.subscription_end_date >= CURRENT_DATE THEN 'Active'
                    WHEN ss.trial_end_date IS NULL AND ss.subscription_end_date IS NULL THEN 'New'
                    ELSE 'Expired'
                END as current_status,
                (SELECT COUNT(*)::int FROM students s WHERE s.institute_id = i.id) as student_count,
                (SELECT COUNT(*)::int FROM teachers t WHERE t.institute_id = i.id) as teacher_count
            FROM institutes i 
            LEFT JOIN subscription_settings ss ON ss.institute_id = i.id
            ORDER BY i.created_at DESC`
        );
        console.log('✅ Query Successful!');
        console.log('Row count:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('Sample row current_status:', result.rows[0].current_status);
        }
        process.exit(0);
    } catch (err) {
        console.error('❌ Query Failed:', err);
        process.exit(1);
    }
};

testAdminQuery();
