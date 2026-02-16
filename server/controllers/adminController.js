import pool from '../config/db.js';

// Get all institutes
const getInstitutes = async (req, res) => {
    console.log('Admin Controller: getInstitutes called');
    try {
        console.log('Executing database query...');
        const result = await pool.query(
            `SELECT 
                i.id, i.institute_name, i.principal_name, i.email, i.mobile, i.district, i.state, 
                i.logo_url, i.principal_photo_url, i.created_at,
                ss.monthly_price, ss.subscription_end_date, ss.override_access,
                CASE 
                    WHEN i.is_active = FALSE THEN 'Disabled'
                    WHEN ss.subscription_end_date >= CURRENT_TIMESTAMP THEN 'Active'
                    WHEN ss.override_access = TRUE THEN 'Grant'
                    ELSE 'Expired'
                END as current_status,
                (SELECT COUNT(*)::int FROM students s WHERE s.institute_id = i.id) as student_count,
                (SELECT COUNT(*)::int FROM teachers t WHERE t.institute_id = i.id) as teacher_count
            FROM institutes i 
            LEFT JOIN subscription_settings ss ON ss.institute_id = i.id
            ORDER BY i.created_at DESC`
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching institutes:', error);
        res.status(500).json({ message: 'Server error while fetching institutes' });
    }
};

// Get single institute details
const getInstituteDetails = async (req, res) => {
    const { id } = req.params;
    console.log(`Admin Controller: Fetching full details for Institute ID: ${id}`);

    try {
        // Step 1: Fetch main institute data with status
        const query = `
            SELECT 
                i.id, i.institute_name, i.principal_name, i.email, i.mobile, 
                i.state, i.district, i.landmark, i.address, i.pincode,
                i.logo_url, i.principal_photo_url, i.created_at,
                ss.monthly_price, ss.subscription_end_date, ss.override_access,
                CASE 
                    WHEN i.is_active = FALSE THEN 'Disabled'
                    WHEN ss.subscription_end_date >= CURRENT_TIMESTAMP THEN 'Active'
                    WHEN ss.override_access = TRUE THEN 'Grant'
                    ELSE 'Expired'
                END as current_status
            FROM institutes i 
            LEFT JOIN subscription_settings ss ON ss.institute_id = i.id
            WHERE i.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: `Institute with ID ${id} not found.` });
        }

        const institute = result.rows[0];

        // Step 2: Fetch student & teacher counts separately for accuracy
        const sCount = await pool.query('SELECT COUNT(*)::int FROM students WHERE institute_id = $1', [id]);
        const tCount = await pool.query('SELECT COUNT(*)::int FROM teachers WHERE institute_id = $1', [id]);

        const response = {
            ...institute,
            stats: {
                students: sCount.rows[0].count || 0,
                teachers: tCount.rows[0].count || 0,
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error(`Admin Controller Details Error [ID: ${id}]:`, error);
        res.status(500).json({
            message: 'Internal server error while loading details',
            error: error.message
        });
    }
};

export { getInstitutes, getInstituteDetails };
