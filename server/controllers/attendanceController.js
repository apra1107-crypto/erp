import pool from '../config/db.js';
import { sendPushNotification, sendMulticastPushNotification } from '../utils/pushNotification.js';
import { Expo } from 'expo-server-sdk';
import { emitToStudent, emitToTeacher } from '../utils/socket.js';

// Take Attendance (Initial save or update for a date)
const takeAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        const { class: className, section, date, attendance } = req.body;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        if (!className || !section || !date || !attendance || !Array.isArray(attendance) || attendance.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        let teacherName = 'Unknown';
        let actualTeacherId = teacherId; 
        
        if (req.user.role === 'principal' || !req.user.institute_id) {
            const principalResult = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [instituteId]);
            teacherName = principalResult.rows[0]?.principal_name || 'Principal';
            actualTeacherId = null; 
        } else {
            const teacherResult = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
            teacherName = teacherResult.rows[0]?.name || 'Unknown';
            actualTeacherId = teacherId; 
        }

        const totalStudents = attendance.length;
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = totalStudents - presentCount;

        // Start Transaction
        await client.query('BEGIN');

        // 1. Get existing attendance in one go to calculate changes
        const existingRes = await client.query(
            'SELECT a.student_id, a.status, s.roll_no FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = $1 AND a.class = $2 AND a.section = $3 AND a.institute_id = $4 AND a.session_id = $5',
            [date, className, section, instituteId, sessionId]
        );

        const prevMap = {};
        existingRes.rows.forEach(row => { prevMap[row.student_id] = { status: row.status, roll_no: row.roll_no }; });
        const isUpdate = existingRes.rows.length > 0;

        let changesSummary = null;
        if (isUpdate) {
            let changesCount = 0;
            let presentToAbsent = [];
            let absentToPresent = [];

            attendance.forEach(({ student_id, status }) => {
                const prevData = prevMap[student_id];
                if (prevData && prevData.status !== status) {
                    changesCount++;
                    if (prevData.status === 'present' && status === 'absent') presentToAbsent.push(prevData.roll_no);
                    if (prevData.status === 'absent' && status === 'present') absentToPresent.push(prevData.roll_no);
                }
            });
            changesSummary = JSON.stringify({ total: changesCount, presentToAbsent, absentToPresent });
        }

        // 2. Perform Bulk Upsert using unnest for maximum performance
        const studentIds = attendance.map(a => a.student_id);
        const statuses = attendance.map(a => a.status);

        await client.query(`
            INSERT INTO attendance (institute_id, teacher_id, student_id, class, section, date, status, updated_at, session_id)
            SELECT $1, $2, unnest($3::int[]), $4, $5, $6, unnest($7::text[]), NOW(), $8
            ON CONFLICT (student_id, date, session_id) 
            DO UPDATE SET status = EXCLUDED.status, teacher_id = EXCLUDED.teacher_id, updated_at = NOW()
        `, [instituteId, actualTeacherId, studentIds, className, section, date, statuses, sessionId]);

        // 3. Insert single audit log
        const logResult = await client.query(
            `INSERT INTO attendance_logs 
            (institute_id, teacher_id, teacher_name, class, section, date, action_type, total_students, present_count, absent_count, changes_made, session_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [instituteId, actualTeacherId, teacherName, className, section, date, isUpdate ? 'modified' : 'initial', totalStudents, presentCount, absentCount, changesSummary, sessionId]
        );
        const logId = logResult.rows[0].id;

        await client.query('COMMIT');

        // Respond to the client immediately
        res.status(isUpdate ? 200 : 201).json({ 
            message: isUpdate ? 'Attendance updated successfully' : 'Attendance saved successfully', 
            stats: { total: totalStudents, present: presentCount, absent: absentCount } 
        });

        // --- Post-response Background Tasks (Push, Socket and Stats) ---
        (async () => {
            try {
                // 1. Instant Push Notifications (Background dispatch)
                sendAttendanceNotifications(attendance, date, teacherName);
                pool.query('UPDATE attendance_logs SET push_sent_at = NOW() WHERE id = $1', [logId]);

                // 2. Socket.io updates
                attendance.forEach(({ student_id, status }) => {
                    emitToStudent(student_id, 'attendance_marked', { status, date, teacher_name: teacherName });
                });

                // 3. Update institute-wide stats
                const statsRes = await pool.query(
                    `SELECT COUNT(*) FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 AND status = 'present'`,
                    [instituteId, sessionId, date]
                );
                emitToTeacher(instituteId, 'attendance_stats_update', { date, total_present: parseInt(statsRes.rows[0].count) });
            } catch (bgError) {
                console.error('[Background Task Error]:', bgError);
            }
        })();

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Take attendance error:', error);
        res.status(500).json({ message: 'Server error while saving attendance' });
    } finally {
        client.release();
    }
};

// Helper function to send notifications
async function sendAttendanceNotifications(attendance, date, teacherName) {
    try {
        const studentIds = attendance.map(a => parseInt(a.student_id));
        
        // Fetch student details
        const tokensRes = await pool.query(
            "SELECT id, name, push_token FROM students WHERE id = ANY($1) AND push_token IS NOT NULL AND push_token != ''",
            [studentIds]
        );

        if (tokensRes.rows.length === 0) return;

        const studentMap = {};
        tokensRes.rows.forEach(r => { 
            studentMap[r.id.toString()] = {
                token: r.push_token,
                name: r.name
            }; 
        });

        const dateObj = new Date(date);
        const formattedDate = `${dateObj.getDate()} ${dateObj.toLocaleString('en-IN', { month: 'short' })} ${dateObj.getFullYear()}`;
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        let messages = [];

        for (const record of attendance) {
            const sid = record.student_id.toString();
            const studentData = studentMap[sid];

            if (studentData && studentData.token && Expo.isExpoPushToken(studentData.token)) {
                const isPresent = record.status === 'present';
                const statusIcon = isPresent ? '✅' : '❌';
                const statusText = isPresent ? 'PRESENT' : 'ABSENT';

                messages.push({
                    to: studentData.token,
                    sound: 'default',
                    title: `${statusIcon} Attendance: ${statusText}`,
                    body: `Dear ${studentData.name}, you have been marked ${statusText} today (${formattedDate}).\n📅 ${formattedDate}  ⏰ ${timeStr}`,
                    priority: 'high',
                    channelId: 'klassin-alerts-v3',
                    data: { 
                        type: 'attendance', 
                        date,
                        status: record.status,
                        teacher_name: teacherName 
                    }
                });
            }
        }

        if (messages.length > 0) {
            await sendMulticastPushNotification(messages);
        }
    } catch (error) {
        console.error('[Push Error] Attendance:', error);
    }
}

// Get Attendance for a specific date/class/section
const getAttendance = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { class: className, section, date } = req.query;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        if (!className || !section || !date) {
            return res.status(400).json({ message: 'Class, section, and date are required' });
        }

        const result = await pool.query(
            `SELECT a.*, s.name as student_name, s.roll_no 
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       WHERE a.date = $1 AND a.class = $2 AND a.section = $3 AND a.institute_id = $4 AND a.session_id = $5
       ORDER BY s.roll_no`,
            [date, className, section, instituteId, sessionId]
        );

        res.status(200).json({ attendance: result.rows || [] });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Get Attendance Logs (audit trail)
const getAttendanceLogs = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { class: className, section, date } = req.query;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        if (!className || !section || !date) {
            return res.status(400).json({ message: 'Class, section, and date are required' });
        }

        const result = await pool.query(
            `SELECT * FROM attendance_logs 
       WHERE date = $1 AND class = $2 AND section = $3 AND institute_id = $4 AND session_id = $5
       ORDER BY created_at ASC`,
            [date, className, section, instituteId, sessionId]
        );

        res.status(200).json({ logs: result.rows });
    } catch (error) {
        console.error('Get attendance logs error:', error);
        res.status(500).json({ message: 'Server error while fetching logs' });
    }
};

// Student: Get my attendance history
const getMyAttendance = async (req, res) => {
    try {
        const studentId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        const { startDate, endDate } = req.query;
        const sessionId = req.user.current_session_id;

        // Fetch attendance with teacher name, if teacher doesn't exist get principal name
        // Middleware already ensures req.user.id is the correct ID for the active session
        const result = await pool.query(
            `SELECT a.id, a.date::TEXT, a.status, a.class, a.section, a.teacher_id,
                    COALESCE(t.name, i.principal_name, 'Unknown') as marked_by,
                    a.updated_at
             FROM attendance a
             LEFT JOIN teachers t ON a.teacher_id = t.id
             LEFT JOIN institutes i ON a.institute_id = i.id
             WHERE a.student_id = $1 
               AND a.institute_id = $2
               AND a.date::TEXT >= $3 
               AND a.date::TEXT <= $4
               AND a.session_id = $5
             ORDER BY a.date DESC`,
            [studentId, instituteId, startDate, endDate, sessionId]
        );
        
        res.status(200).json({ attendance: result.rows });
    } catch (error) {
        console.error('❌ Get my attendance error:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Staff: Get a specific student's attendance history
const getStudentAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        const { startDate, endDate } = req.query;
        const sessionId = req.user.current_session_id;

        // 1. Get original student to get unique_code
        const originalStudent = await pool.query('SELECT unique_code FROM students WHERE id = $1', [studentId]);
        if (originalStudent.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        
        // 2. Find correct record for the active session
        const targetStudent = await pool.query(
            'SELECT id FROM students WHERE unique_code = $1 AND session_id = $2',
            [originalStudent.rows[0].unique_code, sessionId]
        );

        if (targetStudent.rows.length === 0) {
            return res.status(200).json({ attendance: [] });
        }

        const realStudentId = targetStudent.rows[0].id;

        const result = await pool.query(
            `SELECT a.id, a.date::TEXT, a.status, a.class, a.section, a.teacher_id,
                    COALESCE(t.name, i.principal_name, 'Unknown') as marked_by,
                    a.updated_at
             FROM attendance a
             LEFT JOIN teachers t ON a.teacher_id = t.id
             LEFT JOIN institutes i ON a.institute_id = i.id
             WHERE a.student_id = $1 
               AND a.institute_id = $2
               AND a.date::TEXT >= $3 
               AND a.date::TEXT <= $4
               AND a.session_id = $5
             ORDER BY a.date DESC`,
            [realStudentId, instituteId, startDate, endDate, sessionId]
        );

        res.status(200).json({ attendance: result.rows });
    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({ message: 'Server error while fetching attendance' });
    }
};

// Get list of sections with their attendance status for today or a specific date
const getAttendanceStatusBySection = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT DISTINCT class, section 
             FROM attendance 
             WHERE institute_id = $1 AND session_id = $2 AND date = $3`,
            [instituteId, sessionId, targetDate]
        );

        res.status(200).json({ markedSections: result.rows });
    } catch (error) {
        console.error('Get attendance status error:', error);
        res.status(500).json({ message: 'Server error while fetching attendance status' });
    }
};

// Get Attendance Dashboard (Sync all data in one request)
const getAttendanceDashboard = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const { class: className, section, date } = req.query;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        if (!className || !section || !date) {
            return res.status(400).json({ message: 'Class, section, and date are required' });
        }

        // Run all queries in parallel on the DB/Server
        const [studentsRes, attendanceRes, logsRes, requestsRes] = await Promise.all([
            // 1. Fetch Students
            pool.query(
                "SELECT id, name, roll_no, photo_url FROM students WHERE class = $1 AND section = $2 AND institute_id = $3 AND session_id = $4 ORDER BY roll_no::int",
                [className, section, instituteId, sessionId]
            ),
            // 2. Fetch Existing Attendance
            pool.query(
                "SELECT student_id, status FROM attendance WHERE date = $1 AND class = $2 AND section = $3 AND institute_id = $4 AND session_id = $5",
                [date, className, section, instituteId, sessionId]
            ),
            // 3. Fetch Logs
            pool.query(
                "SELECT * FROM attendance_logs WHERE date = $1 AND class = $2 AND section = $3 AND institute_id = $4 AND session_id = $5 ORDER BY created_at DESC",
                [date, className, section, instituteId, sessionId]
            ),
            // 4. Fetch Absent Requests
            pool.query(
                "SELECT r.*, s.name as student_name, s.roll_no, s.photo_url FROM absent_requests r JOIN students s ON r.student_id = s.id WHERE r.date = $1 AND r.class = $2 AND r.section = $3 AND r.institute_id = $4 AND r.session_id = $5",
                [date, className, section, instituteId, sessionId]
            )
        ]);

        // Format attendance into a Map for easy frontend use
        const attendanceMap = {};
        attendanceRes.rows.forEach(a => {
            attendanceMap[a.student_id] = a.status;
        });

        res.status(200).json({
            students: studentsRes.rows,
            attendance: attendanceMap,
            logs: logsRes.rows,
            absentRequests: requestsRes.rows
        });

    } catch (error) {
        console.error('Sync attendance dashboard error:', error);
        res.status(500).json({ message: 'Server error while syncing attendance data' });
    }
};

export { takeAttendance, getAttendance, getAttendanceLogs, getMyAttendance, getStudentAttendance, getAttendanceStatusBySection, getAttendanceDashboard };