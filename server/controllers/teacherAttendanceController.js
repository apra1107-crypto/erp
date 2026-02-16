import pool from '../config/db.js';
import { emitToPrincipal } from '../utils/socket.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { getTodayIST } from '../utils/date.js';

// Get today's attendance status for the logged-in teacher
export const getTodayAttendance = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id;
        const sessionId = req.user.current_session_id;
        const today = getTodayIST();

        const result = await pool.query(
            `SELECT *, marked_at::TEXT as marked_at_text 
             FROM teacher_self_attendance 
             WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3 AND date = $4`,
            [teacherId, instituteId, sessionId, today]
        );

        res.json(result.rows[0] || null);
    } catch (error) {
        console.error('Get teacher attendance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark self attendance
export const markAttendance = async (req, res) => {
    try {
        const { status, reason } = req.body; // 'present' or 'absent', plus optional reason
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id;
        const sessionId = req.user.current_session_id;
        
        const now = new Date();
        const today = getTodayIST();
        const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

        const result = await pool.query(
            `INSERT INTO teacher_self_attendance (institute_id, teacher_id, session_id, date, day, status, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (teacher_id, date, session_id) DO UPDATE SET status = $6, reason = $7, marked_at = CURRENT_TIMESTAMP
             RETURNING *, marked_at::TEXT as marked_at_text`,
            [instituteId, teacherId, sessionId, today, dayName, status, reason || null]
        );

        const markedRecord = result.rows[0];

        // --- NOTIFY PRINCIPAL ---
        try {
            // 1. Get Teacher Name
            const teacherRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
            const teacherName = teacherRes.rows[0]?.name || 'Teacher';

            // 2. Emit Socket Event for real-time bar update
            emitToPrincipal(instituteId, 'teacher_attendance', {
                teacher_id: teacherId,
                teacher_name: teacherName,
                status: status,
                reason: reason || null,
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            });

            // 3. Send Push Notification for banner alert
            const principalRes = await pool.query('SELECT push_token FROM institutes WHERE id = $1', [instituteId]);
            const principalToken = principalRes.rows[0]?.push_token;

            // Get teacher's own token to avoid sending it to themselves if they are logged in on the same device as principal
            const teacherTokenRes = await pool.query('SELECT push_token FROM teachers WHERE id = $1', [teacherId]);
            const teacherToken = teacherTokenRes.rows[0]?.push_token;

            if (principalToken && principalToken !== teacherToken) {
                const nowText = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                
                const title = `Attendance: ${teacherName}`;
                const body = `${teacherName} marked himself ${status.toUpperCase()} today (${todayDate}) at ${nowText}.${reason ? ` Reason: ${reason}` : ''}`;
                await sendPushNotification([principalToken], title, body, { type: 'teacher_attendance', teacherId });
            }
        } catch (notifError) {
            console.error('Error notifying principal of teacher attendance:', notifError);
        }

        res.status(201).json({ message: 'Attendance marked successfully', record: markedRecord });
    } catch (error) {
        console.error('Mark teacher attendance error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get attendance history for a specific month
export const getAttendanceHistory = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id;
        const sessionId = req.user.current_session_id;
        const { month, year } = req.query; // Expecting month (1-12) and year

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const result = await pool.query(
            `SELECT *, marked_at::TEXT as marked_at_text 
             FROM teacher_self_attendance 
             WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3 
             AND EXTRACT(MONTH FROM date) = $4 AND EXTRACT(YEAR FROM date) = $5
             ORDER BY date ASC`,
            [teacherId, instituteId, sessionId, month, year]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get teacher attendance history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Principal: Get attendance history for a specific teacher
export const getTeacherAttendanceHistoryForPrincipal = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const result = await pool.query(
            `SELECT *, marked_at::TEXT as marked_at_text 
             FROM teacher_self_attendance 
             WHERE teacher_id = $1 AND institute_id = $2 AND session_id = $3 
             AND EXTRACT(MONTH FROM date) = $4 AND EXTRACT(YEAR FROM date) = $5
             ORDER BY date ASC`,
            [teacherId, instituteId, sessionId, month, year]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get teacher attendance history error (principal):', error);
        res.status(500).json({ message: 'Server error' });
    }
};
