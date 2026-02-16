import pool from '../config/db.js';
import { sendPromotionEmail } from '../utils/aws.js';
import { emitToStudent } from '../utils/socket.js';

// Promote Student
export const promoteStudent = async (req, res) => {
    try {
        const { studentId, newClass, newSection, newRollNo, targetSessionId } = req.body;
        const instituteId = req.user.institute_id || req.user.id;
        const promotedBy = req.user.name || 'Administration';

        // 1. Get original student data
        const originalStudent = await pool.query(
            'SELECT * FROM students WHERE id = $1 AND institute_id = $2',
            [studentId, instituteId]
        );

        if (originalStudent.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = originalStudent.rows[0];

        // 2. Check if student already promoted to this session
        const promotionCheck = await pool.query(
            'SELECT id FROM students WHERE unique_code = $1 AND session_id = $2 AND is_active = true',
            [student.unique_code, targetSessionId]
        );

        if (promotionCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Student already exists in the target session' });
        }

        // 3. Get target session name for email
        const sessionRes = await pool.query('SELECT name FROM academic_sessions WHERE id = $1', [targetSessionId]);
        const sessionName = sessionRes.rows[0]?.name || 'Next Session';

        // 4. Get institute name
        const instRes = await pool.query('SELECT institute_name FROM institutes WHERE id = $1', [instituteId]);
        const instituteName = instRes.rows[0]?.institute_name || 'Your School';

        // 5. Create new student record for the new session
        const result = await pool.query(
            `INSERT INTO students 
            (institute_id, unique_code, name, class, section, roll_no, dob, gender, 
             father_name, mother_name, mobile, email, address, transport_facility, photo_url, session_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
            RETURNING *`,
            [
                instituteId, 
                student.unique_code, 
                student.name, 
                newClass, 
                newSection, 
                newRollNo, 
                student.dob, 
                student.gender, 
                student.father_name, 
                student.mother_name, 
                student.mobile, 
                student.email, 
                student.address, 
                student.transport_facility, 
                student.photo_url, 
                targetSessionId
            ]
        );

        const promotedStudent = result.rows[0];

        // 6. Send Email Notification
        if (student.email) {
            sendPromotionEmail(
                student.email, 
                student.name, 
                instituteName, 
                { newClass, newSection, newRollNo, sessionName }, 
                promotedBy
            ).catch(err => console.error('Failed to send promotion email:', err));
        }

        // 7. Emit Socket for In-App Banner
        emitToStudent(student.id, 'student_promoted', {
            message: `Congratulations! You have been promoted to Class ${newClass}-${newSection} for session ${sessionName}.`,
            newClass,
            sessionName
        });

        res.status(201).json({
            message: 'Student promoted successfully',
            student: promotedStudent
        });

    } catch (error) {
        console.error('Promotion error:', error);
        res.status(500).json({ message: 'Server error during promotion' });
    }
};

