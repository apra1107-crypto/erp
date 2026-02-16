import pool from '../config/db.js';
import jwt from 'jsonwebtoken';
import { generateUniqueCode } from '../utils/aws.js';
import { formatIndianDate } from '../utils/date.js';
import { sendPushNotification } from '../utils/pushNotification.js';

export const generateAccessCode = () => {
    return generateUniqueCode();
};

export const sendTestNotification = async (req, res) => {
    try {
        const student_id = req.user.id;

        const result = await pool.query(
            'SELECT push_token FROM students WHERE id = $1',
            [student_id]
        );

        if (result.rows.length === 0 || !result.rows[0].push_token) {
            return res.status(404).json({ message: 'Push token not found for this student' });
        }

        const push_token = result.rows[0].push_token;
        console.log(`Sending test notification to: ${push_token}`);

        if (!push_token.startsWith('ExponentPushToken')) {
            return res.status(400).json({ message: `Invalid Token stored: ${push_token.substring(0, 20)}...` });
        }

        const results = await sendPushNotification(
            [push_token],
            "Test Notification 🔔",
            "This is a test notification to verify your device settings. If you hear this, sound is working!",
            { type: 'test' }
        );

        const ticket = results[0];
        if (ticket && ticket.status === 'error') {
            return res.status(500).json({ message: `Expo Error: ${ticket.message} (${ticket.details?.error || 'Unknown'})` });
        }

        res.status(200).json({ message: `Sent: ${ticket?.status || 'Unknown'}. ID: ${ticket?.id || 'N/A'}` });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ message: `Server Error: ${error.message}` });
    }
};

export const updatePushToken = async (req, res) => {
    try {
        const { push_token } = req.body;
        const unique_code = req.user.unique_code; // Use unique_code from JWT

        if (!unique_code) {
            // Fallback to id if unique_code is missing for some reason
            await pool.query(
                'UPDATE students SET push_token = $1 WHERE id = $2',
                [push_token, req.user.id]
            );
        } else {
            await pool.query(
                'UPDATE students SET push_token = $1 WHERE unique_code = $2',
                [push_token, unique_code]
            );
        }

        res.status(200).json({ message: 'Push token updated successfully' });
    } catch (error) {
        console.error('Update push token error:', error);
        res.status(500).json({ message: 'Server error updating push token' });
    }
};

// Verify phone number and get institutes
export const verifyPhone = async (req, res) => {
    try {
        let { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        // Clean mobile number (remove spaces, and only keep last 10 digits if more)
        mobile = mobile.toString().replace(/\s/g, '').slice(-10);

        if (mobile.length < 10) {
            return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
        }

        // Get all institutes that have students with this mobile number
        const result = await pool.query(
            `SELECT DISTINCT i.id, i.institute_name, i.address, i.landmark, i.logo_url
       FROM institutes i
       INNER JOIN students s ON s.institute_id = i.id
       WHERE s.mobile = $1 AND s.is_active = true`,
            [mobile]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No institutes found for this mobile number' });
        }

        res.status(200).json({
            exists: true,
            institutes: result.rows
        });
    } catch (error) {
        console.error('Verify phone error:', error);
        res.status(500).json({ message: 'Server error while verifying phone' });
    }
};

// Get students for institute + mobile combination
export const getStudents = async (req, res) => {
    try {
        let { mobile, institute_id } = req.body;

        if (!mobile || !institute_id) {
            return res.status(400).json({ message: 'Mobile and institute_id are required' });
        }

        mobile = mobile.toString().replace(/\s/g, '').slice(-10);

        // Deduplicate by unique_code to show only one profile (the latest one)
        const result = await pool.query(
            `SELECT DISTINCT ON (unique_code) id, name, class, section, roll_no, photo_url, code_used, unique_code
       FROM students
       WHERE mobile = $1 AND institute_id = $2 AND is_active = true
       ORDER BY unique_code, session_id DESC NULLS LAST, id DESC`,
            [mobile, institute_id]
        );

        res.status(200).json({ students: result.rows });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Server error while fetching students' });
    }
};

// Verify access code and login (first-time users)
export const verifyCode = async (req, res) => {
    try {
        const { student_id, access_code } = req.body;

        if (!student_id || !access_code) {
            return res.status(400).json({ message: 'Student ID and access code are required' });
        }

        // Get student and verify code
        const result = await pool.query(
            `SELECT s.*, i.institute_name, i.logo_url as institute_logo, 
                    i.address as institute_address, i.state, i.district, 
                    i.pincode, i.affiliation
             FROM students s
             INNER JOIN institutes i ON s.institute_id = i.id
             WHERE s.id = $1 AND s.is_active = true`,
            [student_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = result.rows[0];

        // Verify access code (stored in unique_code column)
        if (student.unique_code !== access_code) {
            return res.status(401).json({ message: 'Invalid access code' });
        }

        // Mark code as used
        await pool.query(
            'UPDATE students SET code_used = true WHERE id = $1',
            [student_id]
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                id: student.id,
                unique_code: student.unique_code, // Include unique_code for session switching
                type: 'student',
                institute_id: student.institute_id,
                class: student.class,
                section: student.section
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return student data with full details
        const studentData = {
            id: student.id,
            name: student.name,
            class: student.class,
            section: student.section,
            roll_no: student.roll_no,
            unique_code: student.unique_code,
            dob: formatIndianDate(student.dob),
            gender: student.gender,
            father_name: student.father_name,
            mother_name: student.mother_name,
            mobile: student.mobile,
            email: student.email,
            address: student.address,
            transport_facility: student.transport_facility,
            photo_url: student.photo_url,
            institute_id: student.institute_id,
            current_session_id: student.session_id,
            institute_name: student.institute_name,
            institute_logo: student.institute_logo,
            institute_address: student.institute_address,
            state: student.state,
            district: student.district,
            pincode: student.pincode,
            affiliation: student.affiliation,
            code_used: true
        };

        res.status(200).json({ token, student: studentData });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ message: 'Server error while verifying code' });
    }
};

// Login for returning users (code already used)
export const login = async (req, res) => {
    try {
        const { student_id } = req.body;

        if (!student_id) {
            return res.status(400).json({ message: 'Student ID is required' });
        }

        // Get student
        const result = await pool.query(
            `SELECT s.*, i.institute_name, i.logo_url as institute_logo,
                    i.address as institute_address, i.state, i.district, 
                    i.pincode, i.affiliation
             FROM students s
             INNER JOIN institutes i ON s.institute_id = i.id
             WHERE s.id = $1 AND s.is_active = true`,
            [student_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = result.rows[0];

        // Check if code was used
        if (!student.code_used) {
            return res.status(400).json({ message: 'Please verify access code first' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: student.id,
                unique_code: student.unique_code, // Include unique_code for session switching
                type: 'student',
                institute_id: student.institute_id,
                class: student.class,
                section: student.section
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return student data
        const studentData = {
            id: student.id,
            name: student.name,
            class: student.class,
            section: student.section,
            roll_no: student.roll_no,
            unique_code: student.unique_code,
            dob: formatIndianDate(student.dob),
            gender: student.gender,
            father_name: student.father_name,
            mother_name: student.mother_name,
            mobile: student.mobile,
            email: student.email,
            address: student.address,
            transport_facility: student.transport_facility,
            photo_url: student.photo_url,
            institute_id: student.institute_id,
            current_session_id: student.session_id,
            institute_name: student.institute_name,
            institute_logo: student.institute_logo,
            institute_address: student.institute_address,
            state: student.state,
            district: student.district,
            pincode: student.pincode,
            affiliation: student.affiliation,
            code_used: true
        };

        res.status(200).json({ token, student: studentData });
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'Server error while logging in' });
    }
};

// Get all students for a phone number across all institutes
export const getAllUserAccounts = async (req, res) => {
    try {
        let { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        mobile = mobile.toString().replace(/\s/g, '').slice(-10);

        // Deduplicate by unique_code AND institute_id to show only one profile per school
        const result = await pool.query(
            `SELECT DISTINCT ON (s.institute_id, s.unique_code) 
                    s.id, s.name, s.class, s.section, s.roll_no, s.photo_url, s.code_used, s.unique_code,
                    i.id as institute_id, i.institute_name, i.logo_url as institute_logo, i.landmark
             FROM students s
             INNER JOIN institutes i ON s.institute_id = i.id
             WHERE s.mobile = $1 AND s.is_active = true
             ORDER BY s.institute_id, s.unique_code, s.session_id DESC NULLS LAST`,
            [mobile]
        );

        res.status(200).json({ accounts: result.rows });
    } catch (error) {
        console.error('Get all user accounts error:', error);
        res.status(500).json({ message: 'Server error while fetching accounts' });
    }
};

// Get profile (protected)
export const getProfile = async (req, res) => {
    try {
        const studentId = req.user.id;

        const result = await pool.query(
            `SELECT s.*, i.institute_name, i.logo_url as institute_logo, 
                    i.address as institute_address, i.state, i.district, 
                    i.pincode, i.affiliation
             FROM students s
             INNER JOIN institutes i ON s.institute_id = i.id
             WHERE s.id = $1 AND s.is_active = true`,
            [studentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = result.rows[0];

        const studentData = {
            id: student.id,
            name: student.name,
            class: student.class,
            section: student.section,
            roll_no: student.roll_no,
            unique_code: student.unique_code,
            dob: formatIndianDate(student.dob),
            gender: student.gender,
            father_name: student.father_name,
            mother_name: student.mother_name,
            mobile: student.mobile,
            email: student.email,
            address: student.address,
            transport_facility: student.transport_facility,
            photo_url: student.photo_url,
            institute_id: student.institute_id,
            institute_name: student.institute_name,
            institute_address: student.institute_address,
            institute_logo: student.institute_logo,
            state: student.state,
            district: student.district,
            pincode: student.pincode,
            affiliation: student.affiliation,
            code_used: student.code_used
        };

        res.status(200).json({ student: studentData });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error while fetching profile' });
    }
};

// Update profile (protected)
export const updateProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const {
            name,
            email,
            mobile,
            address,
            dob,
            gender,
            father_name,
            mother_name,
            transport_facility,
            delete_photo
        } = req.body;

        // Get current student
        const currentResult = await pool.query('SELECT photo_url FROM students WHERE id = $1', [studentId]);
        if (currentResult.rows.length === 0) return res.status(404).json({ message: 'Student not found' });

        let photoUrl = currentResult.rows[0].photo_url;

        // Handle Photo
        if (req.file) {
            const { uploadToS3, deleteFromS3 } = await import('../utils/aws.js');
            if (photoUrl) await deleteFromS3(photoUrl);
            photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'students');
        } else if (delete_photo === 'true') {
            const { deleteFromS3 } = await import('../utils/aws.js');
            if (photoUrl) await deleteFromS3(photoUrl);
            photoUrl = null;
        }

        // Update student
        const result = await pool.query(
            `UPDATE students 
             SET name = $1, email = $2, mobile = $3, address = $4, dob = $5, gender = $6,
                 father_name = $7, mother_name = $8, transport_facility = $9, photo_url = $10
             WHERE id = $11 RETURNING *`,
            [name, email, mobile, address, dob, gender, father_name, mother_name, transport_facility === 'true', photoUrl, studentId]
        );

        const student = result.rows[0];

        res.status(200).json({
            message: 'Profile updated successfully',
            student: {
                ...student,
                dob: formatIndianDate(student.dob)
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

// Get Dashboard Data (Attendance + Homework Summary)
export const getStudentDashboardData = async (req, res) => {
    try {
        const studentId = req.user.id;
        const instituteId = req.user.institute_id;
        const className = req.user.class;
        const section = req.user.section;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        const today = new Date().toISOString().split('T')[0];

        // 1. Fetch Today's Attendance
        const attendanceRes = await pool.query(
            'SELECT status FROM attendance WHERE student_id = $1 AND date = $2 AND session_id = $3',
            [studentId, today, sessionId]
        );

        // 2. Fetch Today's Homework for summary
        const homeworkRes = await pool.query(
            `SELECT h.id, h.subject,
                    CASE WHEN hc.id IS NOT NULL THEN true ELSE false END as is_done
             FROM homework h
             LEFT JOIN homework_completions hc ON h.id = hc.homework_id AND hc.student_id = $1
             WHERE h.institute_id = $2 AND h.session_id = $3 AND h.class = $4 AND h.section = $5
             AND h.homework_date = $6
             ORDER BY h.created_at DESC`,
            [studentId, instituteId, sessionId, className, section, today]
        );

        // 3. Fetch Today's Events from Academic Calendar
        const todayEventsRes = await pool.query(
            "SELECT title, description FROM academic_calendar WHERE institute_id = $1 AND session_id = $2 AND event_date = $3",
            [instituteId, sessionId, today]
        );

        res.json({
            attendance: attendanceRes.rows[0] || null,
            homework: homeworkRes.rows,
            today_events: todayEventsRes.rows,
            server_time: new Date()
        });
    } catch (error) {
        console.error('Get student dashboard data error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
