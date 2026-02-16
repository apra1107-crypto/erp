import pool from '../config/db.js';

// Get overview of all class routines
export const getRoutinesOverview = async (req, res) => {
    let instituteId = req.params.instituteId;
    
    // If params is missing or the string "undefined", use user data
    if (!instituteId || instituteId === 'undefined') {
        instituteId = req.user.institute_id || req.user.id;
    }

    const sessionId = req.user.current_session_id;

    if (!instituteId || instituteId === 'undefined' || isNaN(parseInt(instituteId))) {
        return res.status(400).json({ success: false, message: 'Invalid or Missing Institute ID' });
    }

    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Missing Active Session' });
    }

    try {
        const result = await pool.query(
            'SELECT class_name, section, is_published FROM class_routines WHERE institute_id = $1 AND session_id = $2',
            [parseInt(instituteId), sessionId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching routines overview:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// Get specific routine
export const getRoutine = async (req, res) => {
    let instituteId = req.params.instituteId;
    if (!instituteId || instituteId === 'undefined') {
        instituteId = req.user.institute_id || req.user.id;
    }

    const { className, section } = req.params;
    const sessionId = req.user.current_session_id;

    if (!instituteId || instituteId === 'undefined' || isNaN(parseInt(instituteId))) {
        return res.status(400).json({ success: false, message: 'Invalid or Missing Institute ID' });
    }

    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'Missing Active Session' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM class_routines WHERE institute_id = $1 AND class_name = $2 AND section = $3 AND session_id = $4',
            [parseInt(instituteId), className, section, sessionId]
        );
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching routine:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Save routine
export const saveRoutine = async (req, res) => {
    const { instituteId, className, section, config, data, isPublished } = req.body;
    const sessionId = req.user.current_session_id;
    try {
        const result = await pool.query(
            `INSERT INTO class_routines (institute_id, class_name, section, config, data, is_published, session_id, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             ON CONFLICT (institute_id, class_name, section, session_id)
             DO UPDATE SET config = $4, data = $5, is_published = $6, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [instituteId, className, section, config, data, isPublished, sessionId]
        );
        res.json({ success: true, routine: result.rows[0] });
    } catch (error) {
        console.error('Error saving routine:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// Get routine for a student (using token data)
export const getMyRoutine = async (req, res) => {
    try {
        const { institute_id, class: className, section, current_session_id } = req.user;

        if (!className || !section || !current_session_id) {
            return res.json(null);
        }

        const result = await pool.query(
            'SELECT * FROM class_routines WHERE institute_id = $1 AND class_name = $2 AND section = $3 AND session_id = $4 AND is_published = true',
            [institute_id, className, section, current_session_id]
        );

        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching student routine:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// Get teachers for student routine (minimal info)
export const getTeachersForStudent = async (req, res) => {
    try {
        const { institute_id } = req.user;
        const result = await pool.query(
            'SELECT id, name, subject FROM teachers WHERE institute_id = $1 AND is_active = true',
            [institute_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching teachers for student:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// Delete routine
export const deleteRoutine = async (req, res) => {
    const { instituteId, className, section } = req.params;
    const sessionId = req.user.current_session_id;
    try {
        await pool.query(
            'DELETE FROM class_routines WHERE institute_id = $1 AND class_name = $2 AND section = $3 AND session_id = $4',
            [instituteId, className, section, sessionId]
        );
        res.json({ success: true, message: 'Routine deleted successfully' });
    } catch (error) {
        console.error('Error deleting routine:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// Get routine assignments for a teacher
export const getTeacherSchedule = async (req, res) => {
    try {
        const { institute_id, id: teacherId, current_session_id } = req.user;

        // Fetch all published routines for this institute and session
        const result = await pool.query(
            'SELECT class_name, section, config, data FROM class_routines WHERE institute_id = $1 AND is_published = true AND session_id = $2',
            [institute_id, current_session_id]
        );

        const teacherSchedule = [];

        result.rows.forEach(routine => {
            const { class_name, section, config, data } = routine;
            const days = config.days || [];
            const slots = config.slots || [];

            days.forEach(day => {
                const daySlots = data[day] || [];
                daySlots.forEach((slotData, idx) => {
                    // Normalize comparison with String conversion
                    if (slotData && slotData.teacherId && String(slotData.teacherId) === String(teacherId)) {
                        const slotConfig = slots[idx];
                        if (slotConfig) {
                            teacherSchedule.push({
                                className: class_name,
                                section: section,
                                day: day,
                                startTime: slotConfig.startTime,
                                endTime: slotConfig.endTime,
                                subject: slotData.subject,
                                label: slotConfig.label,
                                slotId: slotConfig.id
                            });
                        }
                    }
                });
            });
        });

        // Filter and return
        res.json(teacherSchedule);
    } catch (error) {
        console.error('Error fetching teacher schedule:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
