import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';

export const createAdmitCard = async (req, res) => {
    try {
        const { exam_name, classes, schedule } = req.body;
        const teacher_id = req.user.id;
        const institute_id = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            const sessionRes = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [institute_id]);
            sessionId = sessionRes.rows[0]?.current_session_id;
        }

        console.log(`[AdmitCard] Creating for Inst: ${institute_id}, Session: ${sessionId}`);

        let result;
        // Attempt 1: Full insert
        try {
            result = await pool.query(
                `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule, session_id, is_published)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule), sessionId, false]
            );
        } catch (err1) {
            console.log('[AdmitCard] Create Attempt 1 failed:', err1.message);
            try {
                result = await pool.query(
                    `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule, session_id)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule), sessionId]
                );
            } catch (err2) {
                console.log('[AdmitCard] Create Attempt 2 failed:', err2.message);
                result = await pool.query(
                    `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule)
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule)]
                );
            }
        }

        const admitCard = result.rows[0];
        res.status(201).json({ message: 'Admit card event created successfully', admitCard });
    } catch (error) {
        console.error('[AdmitCard] Fatal Create Error:', error);
        res.status(500).json({ message: 'Failed to create admit card', error: error.message });
    }
};

export const getAdmitCards = async (req, res) => {
    try {
        if (!req.user) return res.status(200).json([]);
        const institute_id = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            const sessionRes = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [institute_id]);
            sessionId = sessionRes.rows[0]?.current_session_id;
        }
        
        console.log(`[AdmitCard] GET /list for Inst: ${institute_id}, Session: ${sessionId}`);

        let result;
        // Attempt 1: Full filter
        if (sessionId) {
            try {
                result = await pool.query(
                    `SELECT *, COALESCE(is_published, false) as is_published FROM admit_cards 
                     WHERE institute_id = $1 AND session_id = $2 
                     ORDER BY created_at DESC`,
                    [institute_id, sessionId]
                );
                return res.status(200).json(result.rows);
            } catch (err1) {
                console.log('[AdmitCard] List Attempt 1 failed:', err1.message);
            }
        }

        // Attempt 2: No session filter
        try {
            result = await pool.query(
                `SELECT *, COALESCE(is_published, false) as is_published FROM admit_cards 
                 WHERE institute_id = $1 
                 ORDER BY created_at DESC`,
                [institute_id]
            );
            return res.status(200).json(result.rows);
        } catch (err2) {
            console.log('[AdmitCard] List Attempt 2 failed:', err2.message);
            try {
                result = await pool.query(
                    `SELECT * FROM admit_cards 
                     WHERE institute_id = $1 
                     ORDER BY created_at DESC`,
                    [institute_id]
                );
                return res.status(200).json(result.rows.map(r => ({ ...r, is_published: false })));
            } catch (err3) {
                console.error('[AdmitCard] List ALL ATTEMPTS FAILED:', err3.message);
                return res.status(200).json([]);
            }
        }
    } catch (error) {
        console.error('[AdmitCard] Fatal List Error:', error);
        res.status(200).json([]);
    }
};

export const getStudentsForAdmitCard = async (req, res) => {
    try {
        const { classes } = req.body;
        const institute_id = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            const sessionRes = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [institute_id]);
            sessionId = sessionRes.rows[0]?.current_session_id;
        }

        if (!classes || classes.length === 0) return res.status(200).json([]);

        let query = `
            SELECT s.*, i.institute_name, i.logo_url as institute_logo
            FROM students s
            INNER JOIN institutes i ON s.institute_id = i.id
            WHERE s.institute_id = $1 AND s.session_id = $2 AND (
        `;

        const params = [institute_id, sessionId];
        const conditions = classes.map(cs => {
            params.push(cs.class, cs.section);
            return `(s.class = $${params.length - 1} AND s.section = $${params.length})`;
        });

        query += conditions.join(' OR ') + ') AND s.is_active = true ORDER BY s.class, s.section, s.roll_no';

        const result = await pool.query(query, params);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[AdmitCard] Get Students Error:', error);
        res.status(200).json([]);
    }
};

export const deleteAdmitCard = async (req, res) => {
    try {
        const { id } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        await pool.query('DELETE FROM admit_cards WHERE id = $1 AND institute_id = $2', [id, instituteId]);
        res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error' });
    }
};

export const toggleAdmitCardVisibility = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_published } = req.body;
        const instituteId = req.user.institute_id || req.user.id;

        try {
            const result = await pool.query(
                `UPDATE admit_cards SET is_published = $1 
                 WHERE id = $2 AND institute_id = $3 RETURNING *`,
                [is_published, id, instituteId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ message: 'Admit card not found' });
            }

            res.status(200).json({ message: 'Success', admitCard: result.rows[0] });
        } catch (dbErr) {
            console.error('[AdmitCard] DB Error in toggle:', dbErr.message);
            // If column is missing, we need to inform the client/system
            if (dbErr.message.includes('is_published')) {
                return res.status(400).json({ 
                    message: 'Database column missing. Please run migration to support publishing.' 
                });
            }
            throw dbErr;
        }
    } catch (error) {
        console.error('[AdmitCard] Toggle Visibility Error:', error);
        res.status(500).json({ message: 'Error updating visibility' });
    }
};

export const getMyAdmitCards = async (req, res) => {
    try {
        const studentId = req.user.id;
        const instituteId = req.user.institute_id;
        const sessionId = req.user.current_session_id;

        const studentRes = await pool.query('SELECT class, section FROM students WHERE id = $1 AND session_id = $2', [studentId, sessionId]);
        if (studentRes.rowCount === 0) return res.status(200).json([]);

        const { class: sClass, section: sSection } = studentRes.rows[0];

        const result = await pool.query(
            `SELECT a.*, i.institute_name, i.logo_url as institute_logo, i.address as institute_address, i.district, i.state, i.pincode, i.affiliation, i.landmark
             FROM admit_cards a
             JOIN institutes i ON a.institute_id = i.id
             WHERE a.institute_id = $1 AND a.session_id = $3
             AND a.classes @> $2::jsonb
             AND a.is_published = true
             ORDER BY a.created_at DESC`,
            [instituteId, JSON.stringify([{ class: sClass, section: sSection }]), sessionId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('[AdmitCard] Student View Error:', error);
        res.status(200).json([]);
    }
};