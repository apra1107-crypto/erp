import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';

export const createAdmitCard = async (req, res) => {
    try {
        const { exam_name, classes, schedule } = req.body;
        const teacher_id = req.user.id;
        const institute_id = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;

        const result = await pool.query(
            `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule, session_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule), sessionId]
        );

        const admitCard = result.rows[0];

        // Send Push Notifications
        if (classes && classes.length > 0) {
            // Construct query to get tokens for students in these classes for THIS session
            let query = `SELECT push_token FROM students WHERE institute_id = $1 AND session_id = $2 AND push_token IS NOT NULL AND (`;
            const params = [institute_id, sessionId];
            
            const conditions = classes.map((c, idx) => {
                params.push(c.class, c.section);
                return `(class = $${params.length - 1} AND section = $${params.length})`;
            });
            
            query += conditions.join(' OR ') + `)`;

            const tokenResult = await pool.query(query, params);
            const tokens = [...new Set(tokenResult.rows.map(row => row.push_token))]; // Unique tokens

            if (tokens.length > 0) {
                const title = exam_name;
                const body = `Your admit for the ${exam_name} is ready. Click here to view it.`;
                const data = { type: 'admit-card', id: admitCard.id };
                
                // Send in background
                sendPushNotification(tokens, title, body, data).catch(err => 
                    console.error('Error sending admit card notifications:', err)
                );
            }
        }

        res.status(201).json({
            message: 'Admit card event created successfully',
            admitCard: admitCard
        });
    } catch (error) {
        console.error('Create admit card error:', error);
        res.status(500).json({ message: 'Failed to create admit card' });
    }
};

export const getAdmitCards = async (req, res) => {
    try {
        const institute_id = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const result = await pool.query(
            `SELECT * FROM admit_cards WHERE institute_id = $1 AND session_id = $2 ORDER BY created_at DESC`,
            [institute_id, sessionId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get admit cards error:', error);
        res.status(500).json({ message: 'Failed to fetch admit cards' });
    }
};

export const getStudentsForAdmitCard = async (req, res) => {
    try {
        const { classes } = req.body; // Array of {class, section}
        const institute_id = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;

        if (!classes || classes.length === 0) {
            return res.status(400).json({ message: 'Classes are required' });
        }

        // Build a query to fetch students from all selected class-sections for this session
        let query = `
            SELECT s.*, i.institute_name, i.logo_url as institute_logo
            FROM students s
            INNER JOIN institutes i ON s.institute_id = i.id
            WHERE s.institute_id = $1 AND s.session_id = $2 AND (
        `;

        const params = [institute_id, sessionId];
        const conditions = [];

        classes.forEach((cs, index) => {
            params.push(cs.class, cs.section);
            conditions.push(`(s.class = $${params.length - 1} AND s.section = $${params.length})`);
        });

        query += conditions.join(' OR ') + ') AND s.is_active = true ORDER BY s.class, s.section, s.roll_no';

        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get students for admit card error:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
};

export const deleteAdmitCard = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.user.current_session_id;
        const userType = req.user.role || req.user.type;

        // If principal, they can delete any card in their institute for current session
        // If teacher, they can only delete their own cards
        let query = '';
        let params = [];

        if (userType === 'principal') {
            query = 'DELETE FROM admit_cards WHERE id = $1 AND institute_id = $2 AND session_id = $3';
            params = [id, instituteId, sessionId];
        } else {
            query = 'DELETE FROM admit_cards WHERE id = $1 AND teacher_id = $2 AND institute_id = $3 AND session_id = $4';
            params = [id, userId, instituteId, sessionId];
        }

        const result = await pool.query(query, params);

        if (result.rowCount === 0) {
            return res.status(403).json({ message: 'Not authorized to delete this card' });
        }

        res.status(200).json({ message: 'Admit card deleted successfully' });
    } catch (error) {
        console.error('Delete admit card error:', error);
        res.status(500).json({ message: 'Failed to delete admit card' });
    }
};

export const getMyAdmitCards = async (req, res) => {
    try {
        const studentId = req.user.id;
        const instituteId = req.user.institute_id;
        const sessionId = req.user.current_session_id;

        // First, get student details to know their class and section for this session
        const studentRes = await pool.query('SELECT class, section FROM students WHERE id = $1 AND session_id = $2', [studentId, sessionId]);
        
        // If student not found in this session (e.g. not promoted yet), return empty list
        if (studentRes.rowCount === 0) return res.status(200).json([]);

        const { class: studentClass, section: studentSection } = studentRes.rows[0];

        // Now find admit card events that contain this class-section combination for this session
        // Since 'classes' is a JSONB array of {class, section} objects
        const result = await pool.query(
            `SELECT a.*, i.institute_name, i.logo_url as institute_logo, i.address as institute_address, i.district, i.state, i.pincode, i.affiliation, i.landmark
             FROM admit_cards a
             JOIN institutes i ON a.institute_id = i.id
             WHERE a.institute_id = $1 AND a.session_id = $3
             AND a.classes @> $2::jsonb
             ORDER BY a.created_at DESC`,
            [instituteId, JSON.stringify([{ class: studentClass, section: studentSection }]), sessionId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get my admit cards error:', error);
        res.status(500).json({ message: 'Failed to fetch your admit cards' });
    }
};
