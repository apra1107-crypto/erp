import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { emitToClass, emitToSpecificTeacher } from '../utils/socket.js';

// Create Homework
export const createHomework = async (req, res) => {
    try {
        const { class_name, section, subject, content, date } = req.body;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role; // Handle both token styles
        const instituteId = req.user.institute_id;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!class_name || !section || !subject || !content || !date) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let teacherId = null;
        let postedByName = '';

        if (userType === 'teacher') {
            teacherId = userId;
            const teacherRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
            postedByName = teacherRes.rows[0]?.name || 'Teacher';
        } else if (userType === 'principal') {
            const principalRes = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [instituteId]);
            postedByName = principalRes.rows[0]?.principal_name || 'Principal';
        }

        const result = await pool.query(
            `INSERT INTO homework (institute_id, teacher_id, session_id, class, section, subject, content, homework_date, posted_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [instituteId, teacherId, sessionId, class_name, section, subject, content, date, postedByName]
        );

        const newHomework = result.rows[0];

        // 1. Emit Socket Event IMMEDIATELY for instant banner
        emitToClass(instituteId, class_name, section, 'new_homework', {
            id: newHomework.id,
            subject: subject,
            teacher_name: postedByName,
            content: content,
            date: date
        });

        // 2. Send Push Notifications in background
        pool.query(
            `SELECT push_token FROM students 
             WHERE institute_id = $1 AND class = $2 AND section = $3 AND push_token IS NOT NULL AND push_token != ''`,
            [instituteId, class_name, section]
        ).then(studentTokensRes => {
            const tokens = studentTokensRes.rows.map(r => r.push_token);
            if (tokens.length > 0) {
                const title = `New Homework: ${subject}`;
                const body = `${postedByName} added homework for ${subject}. Check it out!`;
                sendPushNotification(tokens, title, body, { 
                    type: 'homework', 
                    homeworkId: newHomework.id,
                    subject,
                    teacher_name: postedByName 
                }).catch(err => console.error('BG Push Error:', err));
            }
        });

        res.status(201).json({ message: 'Homework created successfully', homework: newHomework });
    } catch (error) {
        console.error('Create homework error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Homework for a specific class, section and date
export const getHomework = async (req, res) => {
    try {
        const { class_name, section, date } = req.query;
        const instituteId = req.user.institute_id;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;

        let query;
        let params;

        if (userType === 'student') {
            query = `
                SELECT h.*, 
                COALESCE(t.name, h.posted_by_name) as teacher_name,
                CASE WHEN hc.id IS NOT NULL THEN true ELSE false END as is_done
                FROM homework h
                LEFT JOIN teachers t ON h.teacher_id = t.id
                LEFT JOIN homework_completions hc ON h.id = hc.homework_id AND hc.student_id = $6
                WHERE h.institute_id = $1 AND h.session_id = $2 AND h.class = $3 AND h.section = $4 AND h.homework_date = $5
                ORDER BY h.created_at DESC`;
            params = [instituteId, sessionId, class_name, section, date, userId];
        } else {
            query = `
                SELECT h.*, 
                COALESCE(t.name, h.posted_by_name) as teacher_name,
                (SELECT COUNT(*)::int FROM homework_completions WHERE homework_id = h.id) as done_count,
                (SELECT COUNT(*)::int FROM students WHERE institute_id = h.institute_id AND class = h.class AND section = h.section AND is_active = true) as total_students
                FROM homework h
                LEFT JOIN teachers t ON h.teacher_id = t.id
                WHERE h.institute_id = $1 AND h.session_id = $2 AND h.class = $3 AND h.section = $4 AND h.homework_date = $5
                ORDER BY h.created_at DESC`;
            params = [instituteId, sessionId, class_name, section, date];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get homework error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mark Homework as Done (Student)
export const markAsDone = async (req, res) => {
    try {
        const homeworkId = req.params.id;
        const studentId = req.user.id;
        const instituteId = req.user.institute_id;

        const hwRes = await pool.query('SELECT * FROM homework WHERE id = $1', [homeworkId]);
        if (hwRes.rows.length === 0) return res.status(404).json({ message: 'Homework not found' });
        const homework = hwRes.rows[0];

        await pool.query(
            `INSERT INTO homework_completions (homework_id, student_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [homeworkId, studentId]
        );

        const studentRes = await pool.query('SELECT name FROM students WHERE id = $1', [studentId]);
        const studentName = studentRes.rows[0]?.name || 'Student';

        // Notify Teacher if it exists
        if (homework.teacher_id) {
            emitToSpecificTeacher(homework.teacher_id, 'homework_completion_update', {
                homeworkId,
                studentName,
                subject: homework.subject
            });
        }

        res.json({ message: 'Homework marked as done' });
    } catch (error) {
        console.error('Mark homework done error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Homework Completion Details (Teacher/Principal)
export const getHomeworkCompletions = async (req, res) => {
    try {
        const homeworkId = req.params.id;
        const instituteId = req.user.institute_id;

        const hwRes = await pool.query('SELECT class, section FROM homework WHERE id = $1', [homeworkId]);
        if (hwRes.rows.length === 0) return res.status(404).json({ message: 'Homework not found' });
        const { class: className, section } = hwRes.rows[0];

        const doneStudentsRes = await pool.query(
            `SELECT s.id, s.name, s.roll_no, s.photo_url, hc.completed_at
             FROM students s
             JOIN homework_completions hc ON s.id = hc.student_id
             WHERE hc.homework_id = $1
             ORDER BY s.roll_no`,
            [homeworkId]
        );

        const pendingStudentsRes = await pool.query(
            `SELECT s.id, s.name, s.roll_no, s.photo_url
             FROM students s
             WHERE s.institute_id = $1 AND s.class = $2 AND s.section = $3 AND s.is_active = true
             AND s.id NOT IN (SELECT student_id FROM homework_completions WHERE homework_id = $4)
             ORDER BY s.roll_no`,
            [instituteId, className, section, homeworkId]
        );

        res.json({ done: doneStudentsRes.rows, pending: pendingStudentsRes.rows });
    } catch (error) {
        console.error('Get homework completions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update Homework
export const updateHomework = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, content } = req.body;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;
        const instituteId = req.user.institute_id;

        // Allow any staff member from the same institute to edit
        const checkRes = await pool.query(
            'SELECT * FROM homework WHERE id = $1 AND institute_id = $2',
            [id, instituteId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ message: 'Homework not found or unauthorized' });
        }

        const existingHW = checkRes.rows[0];

        let postedByName = '';
        if (userType === 'teacher') {
            const teacherRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [userId]);
            postedByName = teacherRes.rows[0]?.name || 'Teacher';
        } else if (userType === 'principal') {
            const principalRes = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [instituteId]);
            postedByName = principalRes.rows[0]?.principal_name || 'Principal';
        }

        const result = await pool.query(
            `UPDATE homework 
             SET subject = $1, content = $2, posted_by_name = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING *`,
            [subject, content, postedByName, id]
        );

        const updatedHW = result.rows[0];

        // 1. Emit Socket Event
        emitToClass(instituteId, updatedHW.class, updatedHW.section, 'new_homework', {
            id: updatedHW.id,
            subject: subject,
            teacher_name: postedByName,
            content: content,
            date: updatedHW.homework_date,
            isUpdate: true
        });

        // 2. Push Notification in BG
        pool.query(
            `SELECT push_token FROM students 
             WHERE institute_id = $1 AND class = $2 AND section = $3 AND push_token IS NOT NULL AND push_token != ''`,
            [instituteId, updatedHW.class, updatedHW.section]
        ).then(studentTokensRes => {
            const tokens = studentTokensRes.rows.map(r => r.push_token);
            if (tokens.length > 0) {
                const title = `Homework Updated: ${subject}`;
                const body = `${postedByName} updated the homework for ${subject}.`;
                sendPushNotification(tokens, title, body, { 
                    type: 'homework', 
                    homeworkId: updatedHW.id,
                    subject,
                    teacher_name: postedByName 
                }).catch(err => console.error('BG Push Error:', err));
            }
        });

        res.json({ message: 'Homework updated successfully', homework: updatedHW });
    } catch (error) {
        console.error('Update homework error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete Homework
export const deleteHomework = async (req, res) => {
    try {
        const { id } = req.params;
        const instituteId = req.user.institute_id;

        // Allow any staff member from the same institute to delete
        const result = await pool.query(
            'DELETE FROM homework WHERE id = $1 AND institute_id = $2 RETURNING *',
            [id, instituteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Homework not found or unauthorized' });
        }

        res.json({ message: 'Homework deleted successfully' });
    } catch (error) {
        console.error('Delete homework error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};