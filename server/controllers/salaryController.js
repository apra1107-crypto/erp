import pool from '../config/db.js';
import { emitToTeacher } from '../utils/socket.js';
import { sendPushNotification } from '../utils/pushNotification.js';

// Get list of teachers and their salary status for a month
export const getTeacherSalaries = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { month } = req.query; // e.g. "February 2026"
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const query = `
            SELECT 
                t.id, t.name, t.subject, t.photo_url,
                ts.amount, ts.paid_at, ts.status, ts.id as salary_record_id
            FROM teachers t
            LEFT JOIN teacher_salaries ts ON t.id = ts.teacher_id AND ts.month_year = $2 AND ts.session_id = $3
            WHERE t.institute_id = $1 AND t.is_active = true
            ORDER BY t.name ASC
        `;

        const result = await pool.query(query, [instituteId, month, sessionId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get salaries error:', error);
        res.status(500).json({ message: 'Server error fetching salary data' });
    }
};

// Process Salary Payment
export const paySalary = async (req, res) => {
    try {
        const { teacherId, amount, month_year } = req.body;
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const payment_id = `SAL_${Date.now()}`;

        const result = await pool.query(
            `INSERT INTO teacher_salaries (institute_id, teacher_id, session_id, amount, month_year, status, payment_id)
             VALUES ($1, $2, $3, $4, $5, 'paid', $6)
             ON CONFLICT (teacher_id, month_year, session_id) 
             DO UPDATE SET amount = $4, paid_at = CURRENT_TIMESTAMP, payment_id = $6
             RETURNING *`,
            [instituteId, teacherId, sessionId, amount, month_year, payment_id]
        );

        const record = result.rows[0];

        // 1. Emit Socket Event
        emitToTeacher(instituteId, 'salary_received', {
            message: `Salary received for ${month_year}`,
            amount: amount,
            month: month_year
        });

        // 2. Send Push Notification
        try {
            const teacherRes = await pool.query('SELECT push_token FROM teachers WHERE id = $1', [teacherId]);
            const token = teacherRes.rows[0]?.push_token;
            if (token) {
                await sendPushNotification(
                    [token],
                    "Salary Credited 💸",
                    `Your salary for ${month_year} has been marked as paid. Amount: ₹${amount}`,
                    { type: 'salary', month: month_year }
                );
            }
        } catch (pushErr) {}

        res.status(201).json({ message: 'Salary marked as paid', record });
    } catch (error) {
        console.error('Pay salary error:', error);
        res.status(500).json({ message: 'Server error processing salary' });
    }
};

// Teacher: Get my salary history
export const getMySalaryHistory = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const query = `
            SELECT id, amount, month_year, paid_at, payment_id
            FROM teacher_salaries
            WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3
            ORDER BY paid_at DESC
        `;

        const result = await pool.query(query, [teacherId, instituteId, sessionId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get my salary error:', error);
        res.status(500).json({ message: 'Server error fetching salary history' });
    }
};

// Principal: Get salary history for a specific teacher
export const getTeacherSalaryHistoryForPrincipal = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const query = `
            SELECT id, amount, month_year, paid_at, payment_id
            FROM teacher_salaries
            WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3
            ORDER BY paid_at DESC
        `;

        const result = await pool.query(query, [teacherId, instituteId, sessionId]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get teacher salary history error:', error);
        res.status(500).json({ message: 'Server error fetching salary history' });
    }
};
