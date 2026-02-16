import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { emitToClass, emitToTeacher, emitToPrincipal, emitToAllStudents } from '../utils/socket.js';

// Create Notice
export const createNotice = async (req, res) => {
    try {
        const { topic, content, target_audience, target_class, target_section } = req.body;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;
        const instituteId = req.user.institute_id;

        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!topic || !content || !target_audience) {
            return res.status(400).json({ message: 'Topic, content and target audience are required' });
        }

        const result = await pool.query(
            `INSERT INTO notices (institute_id, created_by_role, created_by_id, topic, content, target_audience, target_class, target_section, session_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [instituteId, userType, userId, topic, content, target_audience, target_class, target_section, sessionId]
        );

        const newNotice = result.rows[0];

        // Fetch creator name for notification
        let creatorName = 'Staff';
        if (userType === 'teacher') {
            const tRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [userId]);
            creatorName = tRes.rows[0]?.name || 'Teacher';
        } else {
            const pRes = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [instituteId]);
            creatorName = pRes.rows[0]?.principal_name || 'Principal';
        }

        const notifData = { ...newNotice, creator_name: creatorName };

        // 1. Socket Notifications
        
        // Principal ALWAYS gets notified
        emitToPrincipal(instituteId, 'new_notice', notifData);

        // Targeted Notifications
        if (target_audience === 'all') {
            emitToAllStudents(instituteId, 'new_notice', notifData);
            emitToTeacher(instituteId, 'new_notice', notifData);
        } else if (target_audience === 'teachers') {
            emitToTeacher(instituteId, 'new_notice', notifData);
        } else if (target_audience === 'class') {
            emitToClass(instituteId, target_class, target_section, 'new_notice', notifData);
        }

        // 2. Push Notifications
        const pushTokens = [];
        
        const fetchTokens = async () => {
            try {
                // Always fetch Principal Token
                const pRes = await pool.query('SELECT push_token FROM institutes WHERE id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                pRes.rows.forEach(r => pushTokens.push(r.push_token));

                if (target_audience === 'all') {
                    // Fetch ALL Students
                    const sRes = await pool.query('SELECT push_token FROM students WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    sRes.rows.forEach(r => pushTokens.push(r.push_token));
                    
                    // Fetch ALL Teachers
                    const tRes = await pool.query('SELECT push_token FROM teachers WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    tRes.rows.forEach(r => pushTokens.push(r.push_token));
                } else if (target_audience === 'teachers') {
                    // Fetch ALL Teachers
                    const tRes = await pool.query('SELECT push_token FROM teachers WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    tRes.rows.forEach(r => pushTokens.push(r.push_token));
                } else if (target_audience === 'class') {
                    // Fetch Specific Class Students
                    const sRes = await pool.query(
                        'SELECT push_token FROM students WHERE institute_id = $1 AND class = $2 AND section = $3 AND push_token IS NOT NULL AND push_token != \'\'', 
                        [instituteId, target_class, target_section]
                    );
                    sRes.rows.forEach(r => pushTokens.push(r.push_token));
                }

                const uniqueTokens = [...new Set(pushTokens)];
                if (uniqueTokens.length > 0) {
                    const title = `New Notice: ${topic}`;
                    const body = `${creatorName} published a new notice. Tap to view.`;
                    await sendPushNotification(uniqueTokens, title, body, {
                        type: 'notice',
                        noticeId: newNotice.id,
                        topic: topic
                    });
                }
            } catch (err) {
                console.error('Push notification background error:', err);
            }
        };

        fetchTokens();

        res.status(201).json({ message: 'Notice published successfully', notice: newNotice });
    } catch (error) {
        console.error('Create notice error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Notices
export const getNotices = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;
        const instituteId = req.user.institute_id;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        let query = '';
        let params = [instituteId, sessionId];

        const baseQuery = `
            SELECT n.*, 
            CASE 
                WHEN n.created_by_role = 'teacher' THEN t.name 
                WHEN n.created_by_role = 'principal' THEN i.principal_name 
                ELSE 'Staff'
            END as creator_name
            FROM notices n
            LEFT JOIN teachers t ON n.created_by_role = 'teacher' AND n.created_by_id = t.id
            LEFT JOIN institutes i ON n.created_by_role = 'principal' AND n.created_by_id = i.id
            WHERE n.institute_id = $1 AND n.session_id = $2
        `;

        if (userType === 'student') {
            const studentRes = await pool.query('SELECT class, section FROM students WHERE id = $1', [userId]);
            const { class: className, section } = studentRes.rows[0];
            query = baseQuery + `
                AND (
                    target_audience = 'all' 
                    OR (target_audience = 'class' AND target_class = $3 AND target_section = $4)
                )
                ORDER BY n.created_at DESC`;
            params.push(className, section);
        } else {
            // Staff (Teachers/Principal) can view the entire notice history of the institute
            query = baseQuery + ` ORDER BY n.created_at DESC`;
        }

        const noticesRes = await pool.query(query, params);

        // Fetch Institute Details for the preview screen
        const instRes = await pool.query(
            'SELECT institute_name, logo_url, affiliation, address, landmark, district, state, pincode FROM institutes WHERE id = $1',
            [instituteId]
        );
        const institute = instRes.rows[0];

        res.json({ notices: noticesRes.rows, institute });
    } catch (error) {
        console.error('Get notices error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update Notice
export const updateNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const { topic, content, target_audience, target_class, target_section } = req.body;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;
        const instituteId = req.user.institute_id;

        // Check if notice exists and user is authorized (creator or principal)
        const checkRes = await pool.query(
            'SELECT * FROM notices WHERE id = $1 AND institute_id = $2',
            [id, instituteId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ message: 'Notice not found or unauthorized' });
        }

        const notice = checkRes.rows[0];
        
        // Authorization: Principal can edit anything, Teachers can only edit their own
        if (userType === 'teacher' && (notice.created_by_role !== 'teacher' || notice.created_by_id !== userId)) {
            return res.status(403).json({ message: 'Unauthorized to edit this notice' });
        }

        const result = await pool.query(
            `UPDATE notices 
             SET topic = $1, content = $2, target_audience = $3, target_class = $4, target_section = $5
             WHERE id = $6 RETURNING *`,
            [topic, content, target_audience, target_class, target_section, id]
        );

        const updatedNotice = result.rows[0];

        // Fetch creator name for notification
        let creatorName = 'Staff';
        if (updatedNotice.created_by_role === 'teacher') {
            const tRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [updatedNotice.created_by_id]);
            creatorName = tRes.rows[0]?.name || 'Teacher';
        } else {
            const pRes = await pool.query('SELECT principal_name FROM institutes WHERE id = $1', [updatedNotice.institute_id]);
            creatorName = pRes.rows[0]?.principal_name || 'Principal';
        }

        const notifData = { ...updatedNotice, creator_name: creatorName, isUpdate: true };

        // 1. Socket Notifications
        emitToPrincipal(instituteId, 'new_notice', notifData);

        if (target_audience === 'all') {
            emitToAllStudents(instituteId, 'new_notice', notifData);
            emitToTeacher(instituteId, 'new_notice', notifData);
        } else if (target_audience === 'teachers') {
            emitToTeacher(instituteId, 'new_notice', notifData);
        } else if (target_audience === 'class') {
            emitToClass(instituteId, target_class, target_section, 'new_notice', notifData);
        }

        // 2. Push Notifications
        const pushTokens = [];
        const fetchTokens = async () => {
            try {
                const pRes = await pool.query('SELECT push_token FROM institutes WHERE id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                pRes.rows.forEach(r => pushTokens.push(r.push_token));

                if (target_audience === 'all') {
                    const sRes = await pool.query('SELECT push_token FROM students WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    sRes.rows.forEach(r => pushTokens.push(r.push_token));
                    const tRes = await pool.query('SELECT push_token FROM teachers WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    tRes.rows.forEach(r => pushTokens.push(r.push_token));
                } else if (target_audience === 'teachers') {
                    const tRes = await pool.query('SELECT push_token FROM teachers WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != \'\'', [instituteId]);
                    tRes.rows.forEach(r => pushTokens.push(r.push_token));
                } else if (target_audience === 'class') {
                    const sRes = await pool.query(
                        'SELECT push_token FROM students WHERE institute_id = $1 AND class = $2 AND section = $3 AND push_token IS NOT NULL AND push_token != \'\'', 
                        [instituteId, target_class, target_section]
                    );
                    sRes.rows.forEach(r => pushTokens.push(r.push_token));
                }

                const uniqueTokens = [...new Set(pushTokens)];
                if (uniqueTokens.length > 0) {
                    const title = `Notice Updated: ${topic}`;
                    const body = `${creatorName} has updated the notice. Tap to view changes.`;
                    await sendPushNotification(uniqueTokens, title, body, {
                        type: 'notice',
                        noticeId: updatedNotice.id,
                        topic: topic,
                        isUpdate: true
                    });
                }
            } catch (err) {
                console.error('Push notification background error:', err);
            }
        };
        fetchTokens();

        res.json({ message: 'Notice updated successfully', notice: updatedNotice });
    } catch (error) {
        console.error('Update notice error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete Notice
export const deleteNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.type || req.user.role;
        const instituteId = req.user.institute_id;

        const checkRes = await pool.query(
            'SELECT * FROM notices WHERE id = $1 AND institute_id = $2',
            [id, instituteId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ message: 'Notice not found or unauthorized' });
        }

        const notice = checkRes.rows[0];

        // Authorization: Principal can delete anything, Teachers can only delete their own
        if (userType === 'teacher' && (notice.created_by_role !== 'teacher' || notice.created_by_id !== userId)) {
            return res.status(403).json({ message: 'Unauthorized to delete this notice' });
        }

        await pool.query('DELETE FROM notices WHERE id = $1', [id]);

        res.json({ message: 'Notice deleted successfully' });
    } catch (error) {
        console.error('Delete notice error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
