import pool from '../config/db.js';
import { emitToPrincipal, emitToStudent } from '../utils/socket.js';
import { sendFeeReceiptEmail } from '../utils/aws.js';
import { sendPushNotification } from '../utils/pushNotification.js';

// Helper to parse "Month YYYY" to a Date object (first day of month)
const parseMonthYear = (monthStr) => {
    if (!monthStr || typeof monthStr !== 'string') return new Date();
    const [monthName, year] = monthStr.split(' ');
    const monthIndex = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(monthName);
    return new Date(parseInt(year), monthIndex !== -1 ? monthIndex : 0, 1);
};

// 1. Get current month's configuration or initialize a new one
export const getMonthlyConfig = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month } = req.query; 
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const result = await pool.query(
            'SELECT * FROM fee_configurations WHERE institute_id = $1 AND month_year = $2 AND session_id = $3',
            [instituteId, month, sessionId]
        );

        if (result.rows.length === 0) {
            return res.json({
                month_year: month,
                columns: [],
                class_data: {},
                isNew: true
            });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error fetching monthly config:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 2. Save/Update monthly configuration and Generate Bills
export const saveAndPublishConfig = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month_year, columns, class_data } = req.body;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Upsert Config
        const configQuery = `
            INSERT INTO fee_configurations (institute_id, month_year, columns, class_data, session_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (institute_id, month_year, session_id) 
            DO UPDATE SET columns = $3, class_data = $4, updated_at = CURRENT_TIMESTAMP
            RETURNING id
        `;
        const configRes = await client.query(configQuery, [
            instituteId, month_year, JSON.stringify(columns), JSON.stringify(class_data), sessionId
        ]);
        const configId = configRes.rows[0].id;

        // Delete existing unpaid bills for this month/session
        await client.query(
            'DELETE FROM student_monthly_fees WHERE institute_id = $1 AND month_year = $2 AND status = $3 AND session_id = $4',
            [instituteId, month_year, 'unpaid', sessionId]
        );

        // Fetch all active students for THIS session
        const studentsRes = await client.query(
            `SELECT id, name, class, transport_facility FROM students 
             WHERE institute_id = $1 AND is_active = true AND session_id = $2`,
            [instituteId, sessionId]
        );

        for (const student of studentsRes.rows) {
            const classSettings = class_data[student.class];
            if (!classSettings) continue;

            let breakdown = {};
            let total = 0;

            columns.forEach(col => {
                const trimmedCol = col.trim();
                const colLower = trimmedCol.toLowerCase();
                const isTransport = colLower.includes('transport') || colLower.includes('bus') || colLower.includes('van');
                const rawAmt = classSettings[trimmedCol] || classSettings[col];
                const amt = parseFloat(rawAmt || 0);

                if (amt <= 0) return;

                if (isTransport) {
                    if (student.transport_facility === true) {
                        breakdown[trimmedCol] = amt;
                        total += amt;
                    }
                } else {
                    breakdown[trimmedCol] = amt;
                    total += amt;
                }
            });

            await client.query(`
                INSERT INTO student_monthly_fees (student_id, institute_id, config_id, month_year, breakdown, total_amount, session_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (student_id, month_year, session_id) DO UPDATE 
                SET breakdown = $5, total_amount = $6, updated_at = CURRENT_TIMESTAMP
                WHERE student_monthly_fees.status = 'unpaid'
            `, [student.id, instituteId, configId, month_year, JSON.stringify(breakdown), total, sessionId]);

            emitToStudent(student.id, 'new_fee', { title: "New Monthly Fee 💳", message: `Monthly fee for ${month_year} is ₹${total}.`, amount: total, type: 'monthly', month_year });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Fees published successfully' });

        // Push Notifications
        try {
            const tokensRes = await pool.query("SELECT push_token FROM students WHERE institute_id = $1 AND session_id = $2 AND push_token IS NOT NULL AND is_active = true AND push_token != ''", [instituteId, sessionId]);
            const tokens = tokensRes.rows.map(r => r.push_token);
            if (tokens.length > 0) await sendPushNotification(tokens, "New Fee Published 💳", `Monthly fees for ${month_year} have been published.`, { type: 'fees', month_year });
        } catch (pushErr) {}

    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Failed to publish fees' });
    } finally {
        client.release();
    }
};

// 3. Get High-level tracking for Principal/Teacher
export const getFeesTracking = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const query = `
            SELECT 
                s.class,
                COUNT(s.id) as total_students,
                COUNT(CASE WHEN smf.status = 'paid' THEN 1 END) as paid_count,
                COALESCE(SUM(smf.total_amount), 0) as total_expected,
                COALESCE(SUM(CASE WHEN smf.status = 'paid' THEN smf.total_amount ELSE 0 END), 0) as total_collected
            FROM students s
            LEFT JOIN student_monthly_fees smf ON s.id = smf.student_id AND smf.month_year = $2 AND smf.session_id = $3
            WHERE s.institute_id = $1 AND s.is_active = true AND s.session_id = $3
            GROUP BY s.class
            ORDER BY s.class
        `;
        const result = await pool.query(query, [instituteId, month, sessionId]);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching tracking:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 4. Get Student List for specific Class/Section
export const getSectionFees = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { className, section } = req.params;
    const { month } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const configRes = await pool.query(
            'SELECT columns, class_data FROM fee_configurations WHERE institute_id = $1 AND month_year = $2 AND session_id = $3',
            [instituteId, month, sessionId]
        );

        let query = `
            SELECT 
                s.id, s.name, s.roll_no, s.section, s.class, s.transport_facility, s.photo_url, s.created_at,
                smf.id as fee_record_id, smf.status, smf.total_amount, smf.paid_at, smf.breakdown, smf.payment_id, smf.collected_by
            FROM students s
            LEFT JOIN student_monthly_fees smf ON s.id = smf.student_id AND smf.month_year = $1 AND smf.session_id = $3
            WHERE s.institute_id = $2 AND s.is_active = true AND s.session_id = $3
        `;

        const params = [month, instituteId, sessionId];
        let pIdx = 4;

        if (className !== 'ALL') {
            query += ` AND s.class = $${pIdx++}`;
            params.push(className);
        }
        if (section !== 'ALL') {
            query += ` AND s.section = $${pIdx++}`;
            params.push(section);
        }
        query += ` ORDER BY s.class, s.section, s.roll_no`;

        const studentsRes = await pool.query(query, params);

        const students = studentsRes.rows.map(student => {
            if (student.status) return student;
            let breakdown = {};
            let total = 0;
            if (configRes.rows.length > 0) {
                const config = configRes.rows[0];
                const columns = typeof config.columns === 'string' ? JSON.parse(config.columns) : config.columns;
                const classData = typeof config.class_data === 'string' ? JSON.parse(config.class_data) : config.class_data;
                const classSettings = classData[student.class];
                if (classSettings) {
                    columns.forEach(col => {
                        const trimmedCol = col.trim();
                        const isTransport = trimmedCol.toLowerCase().includes('transport') || trimmedCol.toLowerCase().includes('bus') || trimmedCol.toLowerCase().includes('van');
                        const amt = parseFloat(classSettings[trimmedCol] || 0);
                        if (amt > 0 && (!isTransport || (isTransport && student.transport_facility))) {
                            breakdown[trimmedCol] = amt;
                            total += amt;
                        }
                    });
                }
            }
            return { ...student, status: 'unpaid', total_amount: total, breakdown: breakdown, is_virtual: true };
        });

        res.json(students);
    } catch (error) {
        console.error('Error fetching section fees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 5. Student Dashboard: Get all months and their status
export const getStudentFeeHistory = async (req, res) => {
    const { studentId } = req.params;
    const instituteId = req.user.institute_id || req.user.id;
    const sessionId = req.user.current_session_id;

    try {
        const originalStudentRes = await pool.query('SELECT unique_code FROM students WHERE id = $1', [studentId]);
        if (originalStudentRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
        
        const { unique_code } = originalStudentRes.rows[0];

        const studentRes = await pool.query(
            'SELECT * FROM students WHERE unique_code = $1 AND session_id = $2 AND is_active = true',
            [unique_code, sessionId]
        );

        if (studentRes.rows.length === 0) {
            return res.json({ history: [], totalArrears: 0, message: 'No records for this session' });
        }

        const student = studentRes.rows[0];
        const targetStudentId = student.id;

        const configsRes = await pool.query(
            'SELECT * FROM fee_configurations WHERE institute_id = $1 AND session_id = $2 ORDER BY created_at DESC',
            [student.institute_id, sessionId]
        );

        const monthlyRes = await pool.query(
            `SELECT smf.*, 'monthly' as fee_type FROM student_monthly_fees smf WHERE smf.student_id = $1 AND smf.session_id = $2`,
            [targetStudentId, sessionId]
        );
        const existingMonthlyFees = monthlyRes.rows;

        const occasionalQuery = `
            SELECT MAX(id) as id, MAX(month_year) as month_year, SUM(amount) as total_amount, status, MAX(payment_id) as payment_id, MAX(paid_at) as paid_at, MAX(created_at) as created_at, 'occasional' as fee_type, string_agg(DISTINCT fee_name, ' + ') as title_summary, json_object_agg(fee_name, amount) as breakdown, batch_id, MAX(collected_by) as collected_by
            FROM student_occasional_fees WHERE student_id = $1 AND session_id = $2 GROUP BY batch_id, status, month_year ORDER BY created_at DESC
        `;
        const occasionalRes = await pool.query(occasionalQuery, [targetStudentId, sessionId]);

        const monthlyHistory = configsRes.rows.map(config => {
            const existing = existingMonthlyFees.find(f => f.month_year === config.month_year);
            if (existing) return existing;
            let breakdown = {};
            let total = 0;
            const columns = typeof config.columns === 'string' ? JSON.parse(config.columns) : config.columns;
            const classData = typeof config.class_data === 'string' ? JSON.parse(config.class_data) : config.class_data;
            const classSettings = classData[student.class];
            if (classSettings) {
                columns.forEach(col => {
                    const trimmedCol = col.trim();
                    const isTransport = trimmedCol.toLowerCase().includes('transport') || trimmedCol.toLowerCase().includes('bus') || trimmedCol.toLowerCase().includes('van');
                    const amt = parseFloat(classSettings[trimmedCol] || 0);
                    if (amt > 0 && (!isTransport || (isTransport && student.transport_facility))) {
                        breakdown[trimmedCol] = amt;
                        total += amt;
                    }
                });
            }
            return { id: `VIRTUAL_${config.id}`, student_id: targetStudentId, institute_id: student.institute_id, config_id: config.id, month_year: config.month_year, breakdown, total_amount: total, status: 'unpaid', created_at: config.created_at, fee_type: 'monthly', is_virtual: true };
        });

        const history = [...monthlyHistory, ...occasionalRes.rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const arrears = history.filter(h => h.status === 'unpaid').reduce((acc, curr) => acc + parseFloat(curr.total_amount || 0), 0);

        res.json({ history, totalArrears: arrears });
    } catch (error) {
        console.error('Error fetching student history:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 6. Search students for manual fee entry
export const searchStudentsForFees = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { query, month } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const configRes = await pool.query(
            'SELECT columns, class_data FROM fee_configurations WHERE institute_id = $1 AND month_year = $2 AND session_id = $3',
            [instituteId, month, sessionId]
        );

        const sql = `
            SELECT 
                s.id as student_id, s.name, s.class, s.section, s.roll_no, s.transport_facility, s.photo_url as image, s.created_at,
                smf.id as fee_id, smf.total_amount, smf.status, smf.breakdown, smf.collected_by
            FROM students s
            LEFT JOIN student_monthly_fees smf ON s.id = smf.student_id AND smf.month_year = $3 AND smf.session_id = $4
            WHERE s.institute_id = $1 AND s.name ILIKE $2 AND s.is_active = true AND s.session_id = $4
            LIMIT 10
        `;
        const result = await pool.query(sql, [instituteId, `%${query}%`, month, sessionId]);
        
        const students = result.rows.map(student => {
            if (student.status) return student;
            let breakdown = {};
            let total = 0;
            if (configRes.rows.length > 0) {
                const config = configRes.rows[0];
                const columns = typeof config.columns === 'string' ? JSON.parse(config.columns) : config.columns;
                const classData = typeof config.class_data === 'string' ? JSON.parse(config.class_data) : config.class_data;
                const classSettings = classData[student.class];
                if (classSettings) {
                    columns.forEach(col => {
                        const trimmedCol = col.trim();
                        const isTransport = trimmedCol.toLowerCase().includes('transport') || trimmedCol.toLowerCase().includes('bus');
                        const amt = parseFloat(classSettings[trimmedCol] || 0);
                        if (amt > 0 && (!isTransport || (isTransport && student.transport_facility))) {
                            breakdown[trimmedCol] = amt;
                            total += amt;
                        }
                    });
                }
            }
            return { ...student, status: 'unpaid', total_amount: total, breakdown: breakdown, fee_id: null, is_virtual: true };
        });

        res.json(students);
    } catch (error) {
        console.error('Error searching students for fees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 7. Mark fee as paid manually (Counter Payment)
export const markFeeAsPaidManually = async (req, res) => {
    const { studentFeeId } = req.params;
    const { instituteId, studentId, month_year, collectedBy } = req.body;
    const instId = instituteId || req.user.institute_id || req.user.id;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        let record;
        if (studentFeeId && !studentFeeId.toString().startsWith('VIRTUAL_') && studentFeeId !== 'undefined' && studentFeeId !== 'null') {
            const result = await pool.query(
                `UPDATE student_monthly_fees SET status = 'paid', payment_id = 'COUNTER_' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS'), paid_at = CURRENT_TIMESTAMP, collected_by = $2 WHERE id = $1 AND session_id = $3 RETURNING *`,
                [studentFeeId, collectedBy, sessionId]
            );
            record = result.rows[0];
        } else if (studentId && month_year) {
            const configRes = await pool.query('SELECT id, columns, class_data FROM fee_configurations WHERE institute_id = $1 AND month_year = $2 AND session_id = $3', [instId, month_year, sessionId]);
            if (configRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Fee configuration not found' });
            const config = configRes.rows[0];
            const studentRes = await pool.query('SELECT class, transport_facility FROM students WHERE id = $1 AND session_id = $2', [studentId, sessionId]);
            const student = studentRes.rows[0];
            let breakdown = {};
            let total = 0;
            const columns = typeof config.columns === 'string' ? JSON.parse(config.columns) : config.columns;
            const classData = typeof config.class_data === 'string' ? JSON.parse(config.class_data) : config.class_data;
            const classSettings = classData[student.class];
            if (classSettings) {
                columns.forEach(col => {
                    const trimmedCol = col.trim();
                    const amt = parseFloat(classSettings[trimmedCol] || 0);
                    if (amt > 0) { breakdown[trimmedCol] = amt; total += amt; }
                });
            }
            const result = await pool.query(`INSERT INTO student_monthly_fees (student_id, institute_id, config_id, month_year, breakdown, total_amount, status, payment_id, paid_at, collected_by, session_id) VALUES ($1, $2, $3, $4, $5, $6, 'paid', 'COUNTER_' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS'), CURRENT_TIMESTAMP, $7, $8) RETURNING *`, [studentId, instId, config.id, month_year, JSON.stringify(breakdown), total, collectedBy, sessionId]);
            record = result.rows[0];
        }

        if (record) {
            emitToPrincipal(instId, 'fee_payment_update', { studentFeeId: record.id, status: 'paid' });
            res.json({ success: true, message: 'Payment marked successfully', record });
        } else {
            res.status(404).json({ success: false, message: 'Fee record found failed' });
        }
    } catch (error) {
        console.error('Error marking manual payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 8. Get Defaulters List
export const getDefaulters = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month, className } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        let sql = `
            SELECT s.id as student_id, s.name, s.class, s.section, s.roll_no, s.photo_url, smf.id as fee_id, smf.total_amount, smf.status, smf.breakdown, smf.collected_by, smf.paid_at
            FROM students s
            JOIN student_monthly_fees smf ON s.id = smf.student_id AND smf.session_id = $3
            WHERE s.institute_id = $1 AND smf.month_year = $2 AND smf.status = 'unpaid' AND s.is_active = true AND s.session_id = $3
        `;
        const params = [instituteId, month, sessionId];
        if (className && className !== 'ALL') { sql += ` AND s.class = $4`; params.push(className); }
        sql += ` ORDER BY s.class, s.section, s.roll_no`;
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching defaulters:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get list of months that have configurations
export const getConfiguredMonths = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const result = await pool.query(
            'SELECT month_year FROM fee_configurations WHERE institute_id = $1 AND session_id = $2 GROUP BY month_year ORDER BY MAX(created_at) DESC',
            [instituteId, sessionId]
        );
        res.json(result.rows.map(r => r.month_year));
    } catch (error) {
        console.error('Error fetching configured months:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
