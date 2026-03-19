import pool from '../config/db.js';
import jwt from 'jsonwebtoken';
import { uploadToS3, deleteFromS3, generateUniqueCode } from '../utils/aws.js';

// Generate 6-digit base62 access code
export const generateAccessCode = () => {
    return generateUniqueCode();
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

        // Get all institutes that have teachers with this mobile number
        const result = await pool.query(
            `SELECT DISTINCT i.id, i.institute_name, i.address, i.landmark, i.logo_url
       FROM institutes i
       INNER JOIN teachers t ON t.institute_id = i.id
       WHERE t.mobile = $1 AND t.is_active = true`,
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

// Get teachers for institute + mobile combination
export const getTeachers = async (req, res) => {
    try {
        let { mobile, institute_id } = req.body;

        if (!mobile || !institute_id) {
            return res.status(400).json({ message: 'Mobile and institute_id are required' });
        }

        mobile = mobile.toString().replace(/\s/g, '').slice(-10);

        const result = await pool.query(
            `SELECT id, name, subject, qualification, photo_url, code_used
       FROM teachers
       WHERE mobile = $1 AND institute_id = $2 AND is_active = true
       ORDER BY name`,
            [mobile, institute_id]
        );

        res.status(200).json({ teachers: result.rows });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ message: 'Server error while fetching teachers' });
    }
};

// Verify access code and login (first-time users)
export const verifyCode = async (req, res) => {
    try {
        const { teacher_id, access_code } = req.body;

        if (!teacher_id || !access_code) {
            return res.status(400).json({ message: 'Teacher ID and access code are required' });
        }

        // Get teacher and verify code
        const result = await pool.query(
            `SELECT t.*, i.institute_name, i.logo_url as institute_logo
       FROM teachers t
       INNER JOIN institutes i ON t.institute_id = i.id
       WHERE t.id = $1 AND t.is_active = true`,
            [teacher_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const teacher = result.rows[0];

        // Verify access code (stored in unique_code column)
        if (teacher.unique_code !== access_code) {
            return res.status(401).json({ message: 'Invalid access code' });
        }

        // Mark code as used
        await pool.query(
            'UPDATE teachers SET code_used = true WHERE id = $1',
            [teacher_id]
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                id: teacher.id,
                name: teacher.name,
                type: 'teacher',
                institute_id: teacher.institute_id,
                special_permission: teacher.special_permission
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return teacher data without sensitive info
        const teacherData = {
            id: teacher.id,
            name: teacher.name,
            subject: teacher.subject,
            qualification: teacher.qualification,
            mobile: teacher.mobile,
            photo_url: teacher.photo_url,
            institute_id: teacher.institute_id,
            institute_name: teacher.institute_name,
            institute_logo: teacher.institute_logo,
            special_permission: teacher.special_permission,
            code_used: true
        };

        res.status(200).json({ token, teacher: teacherData });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ message: 'Server error while verifying code' });
    }
};

// Login for returning users (code already used)
export const login = async (req, res) => {
    try {
        const { teacher_id } = req.body;

        if (!teacher_id) {
            return res.status(400).json({ message: 'Teacher ID is required' });
        }

        // Get teacher
        const result = await pool.query(
            `SELECT t.*, i.institute_name, i.logo_url as institute_logo
       FROM teachers t
       INNER JOIN institutes i ON t.institute_id = i.id
       WHERE t.id = $1 AND t.is_active = true`,
            [teacher_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const teacher = result.rows[0];

        // Check if code was used
        if (!teacher.code_used) {
            return res.status(400).json({ message: 'Please verify access code first' });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: teacher.id,
                name: teacher.name,
                type: 'teacher',
                institute_id: teacher.institute_id,
                special_permission: teacher.special_permission
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Return teacher data
        const teacherData = {
            id: teacher.id,
            name: teacher.name,
            subject: teacher.subject,
            qualification: teacher.qualification,
            mobile: teacher.mobile,
            photo_url: teacher.photo_url,
            institute_id: teacher.institute_id,
            institute_name: teacher.institute_name,
            institute_logo: teacher.institute_logo,
            special_permission: teacher.special_permission,
            code_used: true
        };

        res.status(200).json({ token, teacher: teacherData });
    } catch (error) {
        console.error('Teacher login error:', error);
        res.status(500).json({ message: 'Server error while logging in' });
    }
};

// Get all teachers for a phone number across all institutes
export const getAllUserAccounts = async (req, res) => {
    try {
        let { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({ message: 'Mobile number is required' });
        }

        mobile = mobile.toString().replace(/\s/g, '').slice(-10);

        const result = await pool.query(
            `SELECT t.id, t.name, t.subject, t.qualification, t.photo_url, t.code_used, t.unique_code,
                    i.id as institute_id, i.institute_name, i.logo_url as institute_logo, i.landmark
             FROM teachers t
             INNER JOIN institutes i ON t.institute_id = i.id
             WHERE t.mobile = $1 AND t.is_active = true
             ORDER BY i.institute_name, t.name`,
            [mobile]
        );

        res.status(200).json({ accounts: result.rows });
    } catch (error) {
        console.error('Get all user accounts error:', error);
        res.status(500).json({ message: 'Server error while fetching accounts' });
    }
};

// Get Teacher Profile
export const getProfile = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const result = await pool.query(
            `SELECT t.*, i.institute_name, i.logo_url as institute_logo, i.address as institute_address,
                    i.landmark, i.district, i.state, i.pincode, i.affiliation
             FROM teachers t
             INNER JOIN institutes i ON t.institute_id = i.id
             WHERE t.id = $1 AND t.is_active = true`,
            [teacherId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        res.status(200).json({ teacher: result.rows[0] });
    } catch (error) {
        console.error('Get teacher profile error:', error);
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
};

// Update Teacher Profile
export const updateProfile = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const {
            name,
            dob,
            mobile,
            email,
            subject,
            qualification,
            gender,
            address,
            delete_photo
        } = req.body;

        // Get current teacher
        const current = await pool.query('SELECT photo_url FROM teachers WHERE id = $1', [teacherId]);
        if (current.rows.length === 0) return res.status(404).json({ message: 'Teacher not found' });

        let photoUrl = current.rows[0].photo_url;

        // Handle Photo
        if (req.file) {
            if (photoUrl) await deleteFromS3(photoUrl);
            photoUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype, 'teachers');
        } else if (delete_photo === 'true') {
            if (photoUrl) await deleteFromS3(photoUrl);
            photoUrl = null;
        }

        // Update DB
        const result = await pool.query(
            `UPDATE teachers 
             SET name = $1, dob = $2, mobile = $3, email = $4, subject = $5, qualification = $6, 
                 gender = $7, address = $8, photo_url = $9, updated_at = NOW()
             WHERE id = $10 RETURNING *`,
            [name, dob, mobile, email, subject, qualification, gender, address, photoUrl, teacherId]
        );

        res.status(200).json({
            message: 'Profile updated successfully',
            teacher: result.rows[0]
        });

    } catch (error) {
        console.error('Update teacher profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

// Update Push Token
export const updatePushToken = async (req, res) => {
    try {
        const teacher_id = req.user.id;
        const { push_token } = req.body;

        if (!push_token) {
            return res.status(400).json({ message: 'Push token is required' });
        }

        await pool.query(
            'UPDATE teachers SET push_token = $1 WHERE id = $2',
            [push_token, teacher_id]
        );

        res.status(200).json({ message: 'Push token updated successfully' });
    } catch (error) {
        console.error('Update teacher push token error:', error);
        res.status(500).json({ message: 'Server error while updating push token' });
    }
};


