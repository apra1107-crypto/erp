import pool from '../config/db.js';
import { sendFeeReceiptEmail } from '../utils/aws.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { emitToStudent } from '../utils/socket.js';

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

export const addOccasionalCharge = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { studentIds, month_year, charges } = req.body;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    if (!studentIds || !studentIds.length || !month_year || !charges || !charges.length) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const batch_id = `BATCH_${Date.now()}`;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const studentId of studentIds) {
            let studentTotal = 0;
            const feeNames = charges.filter(c => c.fee_name && c.amount).map(c => c.fee_name).join(', ');
            for (const charge of charges) {
                if (!charge.fee_name || !charge.amount) continue;
                studentTotal += parseFloat(charge.amount);
                await client.query(
                    `INSERT INTO student_occasional_fees (student_id, institute_id, month_year, fee_name, amount, status, batch_id, session_id)
                     VALUES ($1, $2, $3, $4, $5, 'unpaid', $6, $7)`,
                    [studentId, instituteId, month_year, charge.fee_name, charge.amount, batch_id, sessionId]
                );
            }
            // Emit real-time notification
            emitToStudent(studentId, 'new_fee', {
                title: "New Fee Charge 📢",
                message: `New occasional charges applied: ₹${studentTotal}.`,
                feeName: feeNames,
                amount: studentTotal,
                type: 'occasional'
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: `Occasional charges applied successfully`, batch_id });

        // --- Send Push Notifications to targeted Students ---
        try {
            const tokensRes = await pool.query(
                "SELECT push_token FROM students WHERE id = ANY($1) AND push_token IS NOT NULL AND is_active = true AND push_token != '' AND session_id = $2",
                [studentIds, sessionId]
            );
            const tokens = tokensRes.rows.map(r => r.push_token);
            if (tokens.length > 0) {
                const reasons = charges.map(c => c.fee_name).join(', ');
                await sendPushNotification(
                    tokens,
                    "New Fee Charge 📢",
                    `New charges (${reasons}) have been applied to your account.`,
                    { type: 'fees', batch_id }
                );
            }
        } catch (pushErr) {
            console.error('Error sending occasional fee push notifications:', pushErr);
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding occasional charge:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
};

export const markOccasionalPaid = async (req, res) => {
    const { id } = req.params; // occasional fee id
    const { payment_id, collectedBy } = req.body;
    const instituteId = req.user.institute_id || req.user.id;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const updateRes = await pool.query(
            `UPDATE student_occasional_fees SET status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP, collected_by = $3 WHERE id = $2 AND session_id = $4 RETURNING *`,
            [payment_id || `COUNTER_${Date.now()}`, id, collectedBy, sessionId]
        );
        const record = updateRes.rows[0];

        if (record) {
            // Background email send
            try {
                const studentDataRes = await pool.query('SELECT name, email, roll_no, class, section FROM students WHERE id = $1', [record.student_id]);
                const studentData = studentDataRes.rows[0];
                if (studentData && studentData.email) {
                    const instDataRes = await pool.query('SELECT institute_name, logo_url, address, state, district, pincode, affiliation FROM institutes WHERE id = $1', [record.institute_id]);
                    const instData = instDataRes.rows[0];
                    if (instData) {
                        const feeRecord = {
                            ...record,
                            total_amount: record.amount,
                            breakdown: { [record.fee_name || 'Occasional Fee']: record.amount },
                            class: studentData.class,
                            section: studentData.section,
                            roll_no: studentData.roll_no
                        };
                        sendFeeReceiptEmail(studentData.email, studentData.name, record.amount, feeRecord, instData);
                    }
                }

                // --- Send Push Notification to Student ---
                const tokenRes = await pool.query('SELECT push_token FROM students WHERE id = $1', [record.student_id]);
                const token = tokenRes.rows[0]?.push_token;
                if (token) {
                    const title = "Fees Paid ✅";
                    const body = `Your occasional fee of ₹${record.amount} (${record.fee_name}) has been received.`;
                    const data = { type: 'fees', id: record.id };
                    sendPushNotification([token], title, body, data).catch(err => 
                        console.error('Error sending push notification to student:', err)
                    );
                }
            } catch (err) { console.error('Occasional Email/Push Error:', err); }
        }

        res.json({ success: true, message: 'Occasional fee marked as paid' });
    } catch (error) {
        console.error('Error marking occasional fee as paid:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const markStudentBatchPaid = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { batch_id, student_id, collectedBy } = req.body;
    const payment_id = `COUNTER_${Date.now()}`;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const updateRes = await pool.query(
            `UPDATE student_occasional_fees 
             SET status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP, collected_by = $5
             WHERE institute_id = $2 AND batch_id = $3 AND student_id = $4 AND status = 'unpaid' AND session_id = $6
             RETURNING *`,
            [payment_id, instituteId, batch_id, student_id, collectedBy, sessionId]
        );

        const records = updateRes.rows;
        if (records.length > 0) {
            try {
                const studentDataRes = await pool.query('SELECT name, email, roll_no, class, section FROM students WHERE id = $1', [student_id]);
                const studentData = studentDataRes.rows[0];
                if (studentData && studentData.email) {
                    const instDataRes = await pool.query('SELECT institute_name, logo_url, address, state, district, pincode, affiliation FROM institutes WHERE id = $1', [instituteId]);
                    const instData = instDataRes.rows[0];
                    if (instData) {
                        const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
                        const breakdown = {};
                        records.forEach(r => { breakdown[r.fee_name || 'Occasional Fee'] = r.amount; });
                        const feeRecord = {
                            ...records[0],
                            total_amount: totalAmount,
                            breakdown,
                            class: studentData.class,
                            section: studentData.section,
                            roll_no: studentData.roll_no
                        };
                        sendFeeReceiptEmail(studentData.email, studentData.name, totalAmount, feeRecord, instData);
                    }
                }

                // --- Send Push Notification to Student ---
                const tokenRes = await pool.query('SELECT push_token FROM students WHERE id = $1', [student_id]);
                const token = tokenRes.rows[0]?.push_token;
                if (token) {
                    const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
                    const title = "Fees Paid ✅";
                    const body = `Your occasional fees totaling ₹${totalAmount} have been received.`;
                    const data = { type: 'fees', batch_id: batch_id };
                    sendPushNotification([token], title, body, data).catch(err => 
                        console.error('Error sending push notification to student:', err)
                    );
                }
            } catch (err) { console.error('Occasional Batch Email/Push Error:', err); }
        }

        res.json({ success: true, message: 'Student fees marked as paid for this batch' });
    } catch (error) {
        console.error('Error marking student batch as paid:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getOccasionalHistory = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        console.log(`[Occasional] Fetching history for inst: ${instituteId}, month: ${month}, session: ${sessionId}`);
        const query = `
            SELECT 
                batch_id, 
                MAX(created_at) as created_at_max, 
                COUNT(DISTINCT student_id) as total_students,
                COUNT(DISTINCT CASE WHEN status = 'paid' THEN student_id END) as paid_students,
                COALESCE(SUM(amount), 0) as total_expected,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_collected,
                STRING_AGG(DISTINCT fee_name, ', ') as reasons,
                MAX(collected_by) as collected_by,
                MAX(paid_at) as paid_at
            FROM student_occasional_fees
            WHERE institute_id = $1 AND month_year = $2 AND session_id = $3
            GROUP BY batch_id
            ORDER BY created_at_max DESC
        `;
        const result = await pool.query(query, [instituteId, month, sessionId]);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching occasional history:', error.message, error.stack);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

export const getOccasionalFeeDetails = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { batch_id } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const query = `
            SELECT 
                of.student_id, 
                s.name, 
                s.roll_no, 
                s.class, 
                s.section, 
                s.photo_url,
                SUM(of.amount) as total_amount,
                STRING_AGG(of.fee_name, ' + ') as items,
                STRING_AGG(of.amount::text, ' + ') as amount_breakdown,
                CASE WHEN COUNT(CASE WHEN of.status = 'unpaid' THEN 1 END) = 0 THEN 'paid' ELSE 'unpaid' END as status,
                MAX(of.collected_by) as collected_by,
                MAX(of.paid_at) as paid_at,
                MAX(of.payment_id) as payment_id
            FROM student_occasional_fees of
            JOIN students s ON of.student_id = s.id
            WHERE of.institute_id = $1 AND of.batch_id = $2 AND of.session_id = $3
            GROUP BY of.student_id, s.name, s.roll_no, s.class, s.section, s.photo_url
            ORDER BY s.class, s.section, s.roll_no
        `;
        const result = await pool.query(query, [instituteId, batch_id, sessionId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching occasional details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getOccasionalTypes = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const result = await pool.query(
            'SELECT * FROM occasional_fee_master WHERE institute_id = $1 AND session_id = $2 ORDER BY fee_name',
            [instituteId, sessionId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching occasional types:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const saveOccasionalType = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { fee_name, default_amount } = req.body;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const result = await pool.query(
            `INSERT INTO occasional_fee_master (institute_id, fee_name, default_amount, session_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (institute_id, fee_name, session_id) 
             DO UPDATE SET default_amount = $3
             RETURNING *`,
            [instituteId, fee_name, default_amount, sessionId]
        );
        res.json({ success: true, message: 'Occasional fee type saved', data: result.rows[0] });
    } catch (error) {
        console.error('Error saving occasional type:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const deleteOccasionalType = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM occasional_fee_master WHERE id = $1', [id]);
        res.json({ success: true, message: 'Occasional fee type deleted' });
    } catch (error) {
        console.error('Error deleting occasional type:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 9. Get Occasional Defaulters
export const getOccasionalDefaulters = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { month, className } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        let sql = `
            SELECT 
                s.id as student_id, s.name, s.class, s.section, s.roll_no, s.photo_url,
                json_agg(json_build_object(
                    'fee_name', sof.fee_name,
                    'amount', sof.amount,
                    'batch_id', sof.batch_id
                )) as fees_breakdown,
                SUM(sof.amount) as total_amount
            FROM students s
            JOIN student_occasional_fees sof ON s.id = sof.student_id AND sof.session_id = $3
            WHERE s.institute_id = $1 
            AND sof.month_year = $2
            AND sof.status = 'unpaid'
            AND s.is_active = true AND s.session_id = $3
        `;

        const params = [instituteId, month, sessionId];
        if (className && className !== 'ALL') {
            sql += ` AND s.class = $4`;
            params.push(className);
        }

        sql += ` GROUP BY s.id, s.name, s.class, s.section, s.roll_no, s.photo_url`;
        sql += ` ORDER BY s.class, s.section, s.roll_no`;

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching occasional defaulters:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// 10. Search Students for Occasional Fee Manual Pay
export const searchStudentsForOccasionalFees = async (req, res) => {
    const instituteId = req.params.instituteId || req.user.institute_id || req.user.id;
    const { query, month } = req.query;
    let sessionId = req.user.current_session_id;

    if (!sessionId || sessionId === 'undefined') {
        const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
        sessionId = sessionResult.rows[0]?.current_session_id;
    }

    try {
        const sql = `
            SELECT 
                s.id as student_id, s.name, s.class, s.section, s.roll_no,
                json_agg(json_build_object(
                    'id', sof.id,
                    'fee_name', sof.fee_name,
                    'amount', sof.amount,
                    'batch_id', sof.batch_id,
                    'status', sof.status,
                    'collected_by', sof.collected_by
                )) as occasional_fees,
                SUM(CASE WHEN sof.status = 'unpaid' THEN sof.amount ELSE 0 END) as total_pending,
                CASE WHEN COUNT(CASE WHEN sof.status = 'unpaid' THEN 1 END) = 0 THEN 'paid' ELSE 'unpaid' END as overall_status
            FROM students s
            JOIN student_occasional_fees sof ON s.id = sof.student_id AND sof.session_id = $4
            WHERE s.institute_id = $1 
            AND s.name ILIKE $2
            AND sof.month_year = $3
            AND s.is_active = true AND s.session_id = $4
            GROUP BY s.id, s.name, s.class, s.section, s.roll_no
            LIMIT 10
        `;
        const result = await pool.query(sql, [instituteId, `%${query}%`, month, sessionId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching occasional fees:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
