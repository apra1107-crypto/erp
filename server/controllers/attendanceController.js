import pool from '../config/db.js';
import { sendPushNotification, sendMulticastPushNotification } from '../utils/pushNotification.js';
import { Expo } from 'expo-server-sdk';
import { emitToStudent, emitToTeacher } from '../utils/socket.js';

// Take Attendance (Initial save for a date)
const takeAttendance = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        const { class: className, section, date, attendance } = req.body;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        if (!className || !section || !date || !attendance || !Array.isArray(attendance)) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        let teacherName = 'Unknown';
        let actualTeacherId = teacherId; 
        
        if (req.user.role === 'principal') {
            const principalResult = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [instituteId]);
            teacherName = principalResult.rows[0]?.principal_name || 'Principal';
            actualTeacherId = null; 
        } else {
            const teacherResult = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
            teacherName = teacherResult.rows[0]?.name || 'Unknown';
            actualTeacherId = teacherId; 
        }

        // Check if attendance already exists
        const existingCheck = await pool.query(
            'SELECT COUNT(*) FROM attendance WHERE date = $1 AND class = $2 AND section = $3 AND institute_id = $4 AND session_id = $5',
            [date, className, section, instituteId, sessionId]
        );

        const isUpdate = parseInt(existingCheck.rows[0].count) > 0;
        const totalStudents = attendance.length;
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = totalStudents - presentCount;

        if (isUpdate) {
            const prevAttendance = await pool.query(
                'SELECT a.student_id, a.status, s.roll_no FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.date = $1 AND a.class = $2 AND a.section = $3 AND a.institute_id = $4 AND a.session_id = $5',
                [date, className, section, instituteId, sessionId]
            );

            const prevMap = {};
            prevAttendance.rows.forEach(row => { prevMap[row.student_id] = { status: row.status, roll_no: row.roll_no }; });

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

            const changesSummary = JSON.stringify({ total: changesCount, presentToAbsent, absentToPresent });

            for (const { student_id, status } of attendance) {
                await pool.query(
                    `INSERT INTO attendance (institute_id, teacher_id, student_id, class, section, date, status, updated_at, session_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
           ON CONFLICT (student_id, date, session_id) 
           DO UPDATE SET status = $7, teacher_id = $2, updated_at = NOW()`,
                    [instituteId, actualTeacherId, student_id, className, section, date, status, sessionId]
                );
                
                // Emit socket event to each student
                emitToStudent(student_id, 'attendance_marked', { 
                    status, 
                    date, 
                    teacher_name: teacherName 
                });
            }

            await pool.query(
                `INSERT INTO attendance_logs 
         (institute_id, teacher_id, teacher_name, class, section, date, action_type, total_students, present_count, absent_count, changes_made, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [instituteId, actualTeacherId, teacherName, className, section, date, 'modified', totalStudents, presentCount, absentCount, changesSummary, sessionId]
            );

            // Send notifications for modified records
            await sendAttendanceNotifications(attendance, date, teacherName);

            // Fetch updated institute stats and emit to teachers
            const statsRes = await pool.query(
                `SELECT COUNT(*) FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 AND status = 'present'`,
                [instituteId, sessionId, date]
            );
            const totalInstitutePresent = parseInt(statsRes.rows[0].count);
            emitToTeacher(instituteId, 'attendance_stats_update', {
                date,
                total_present: totalInstitutePresent
            });

            return res.status(200).json({ message: 'Attendance updated successfully', stats: { total: totalStudents, present: presentCount, absent: absentCount } });
        } else {
            for (const { student_id, status } of attendance) {
                await pool.query(
                    `INSERT INTO attendance (institute_id, teacher_id, student_id, class, section, date, status, session_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [instituteId, actualTeacherId, student_id, className, section, date, status, sessionId]
                );

                // Emit socket event to each student
                emitToStudent(student_id, 'attendance_marked', { 
                    status, 
                    date, 
                    teacher_name: teacherName 
                });
            }

            await pool.query(
                `INSERT INTO attendance_logs 
         (institute_id, teacher_id, teacher_name, class, section, date, action_type, total_students, present_count, absent_count, changes_made, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [instituteId, actualTeacherId, teacherName, className, section, date, 'initial', totalStudents, presentCount, absentCount, null, sessionId]
            );

            // Send notifications for initial records
            await sendAttendanceNotifications(attendance, date, teacherName);

            // Fetch updated institute stats and emit to teachers
            const statsRes = await pool.query(
                `SELECT COUNT(*) FROM attendance WHERE institute_id = $1 AND session_id = $2 AND date = $3 AND status = 'present'`,
                [instituteId, sessionId, date]
            );
            const totalInstitutePresent = parseInt(statsRes.rows[0].count);
            emitToTeacher(instituteId, 'attendance_stats_update', {
                date,
                total_present: totalInstitutePresent
            });

            return res.status(201).json({ message: 'Attendance saved successfully', stats: { total: totalStudents, present: presentCount, absent: absentCount } });
        }
    } catch (error) {
        console.error('Take attendance error:', error);
        res.status(500).json({ message: 'Server error while saving attendance' });
    }
};

// Helper function to send notifications
async function sendAttendanceNotifications(attendance, date, teacherName) {
    try {
        const studentIds = attendance.map(a => parseInt(a.student_id));
        console.log(`[Notification] Preparing attendance notifications for ${studentIds.length} students on ${date}`);
        
        // Fetch student details including photo_url
        const tokensRes = await pool.query(
            "SELECT id, name, push_token, photo_url FROM students WHERE id = ANY($1) AND push_token IS NOT NULL AND push_token != ''",
            [studentIds]
        );

        console.log(`[Notification] Found ${tokensRes.rows.length} students with active push tokens`);

        // Use string keys for the map
        const studentMap = {};
        tokensRes.rows.forEach(r => { 
            studentMap[r.id.toString()] = {
                token: r.push_token,
                name: r.name,
                photo: r.photo_url
            }; 
        });

        // Format Date: "12th Feb 2026"
        const dateObj = new Date(date);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleString('en-IN', { month: 'short' });
        const year = dateObj.getFullYear();
        const formattedDate = `${day} ${month} ${year}`;
        
        // Get Time: "10:30 AM"
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        let messages = [];

        for (const record of attendance) {
            const sid = record.student_id.toString();
            const studentData = studentMap[sid];

            if (studentData && studentData.token && Expo.isExpoPushToken(studentData.token)) {
                const isPresent = record.status === 'present';
                
                // Customize UI based on status
                const statusColor = isPresent ? '#2ecc71' : '#e74c3c'; // Green or Red
                const statusIcon = isPresent ? '✅' : '❌';
                const statusText = isPresent ? 'PRESENT' : 'ABSENT';

                // Professional Message Format
                const title = `${statusIcon} Attendance: ${statusText}`;
                const body = `Dear ${studentData.name}, you have been marked ${statusText} today (${formattedDate}).\n📅 ${formattedDate}  ⏰ ${timeStr}`;

                messages.push({
                    to: studentData.token,
                    sound: 'default',
                    title: title,
                    body: body,
                    data: { 
                        type: 'attendance', 
                        date,
                        student_id: sid,
                        status: record.status,
                        photo_url: studentData.photo,
                        teacher_name: teacherName, // Added teacher name here
                        student_name: studentData.name // Added student name for robust UI handling
                    },
                    // Android Specific UI Enhancements
                    android: {
                        color: statusColor, // Icon/Accent Color
                        largeIcon: studentData.photo || undefined, // Student Face on the right
                        channelId: 'klassin-alerts-v2', // High Priority Channel
                    },
                    // iOS Specific
                    ios: {
                        sound: 'default',
                        _displayInForeground: true
                    }
                });
            }
        }

        if (messages.length > 0) {
            await sendMulticastPushNotification(messages);
        } else {
            console.log('[Notification] No valid tokens to send to.');
        }

    } catch (error) {
        console.error('[Notification] Error in sendAttendanceNotifications:', error);
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

export { takeAttendance, getAttendance, getAttendanceLogs, getMyAttendance, getStudentAttendance, getAttendanceStatusBySection };