import pool from '../config/db.js';

// Student: Submit absent request
const submitRequest = async (req, res) => {
    try {
        const studentId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        let studentClass = req.user.class;
        let studentSection = req.user.section;
        const sessionId = req.user.current_session_id;

        // If class/section missing from JWT, fetch from DB
        if (!studentClass || !studentSection) {
            const studentResult = await pool.query(
                'SELECT class, section FROM students WHERE id = $1 AND session_id = $2',
                [studentId, sessionId]
            );
            if (studentResult.rows.length > 0) {
                studentClass = studentResult.rows[0].class;
                studentSection = studentResult.rows[0].section;
            }
        }

        const { date, reason } = req.body;

        if (!date || !reason) {
            return res.status(400).json({ message: 'Date and reason are required' });
        }

        // Check if request already exists for this date and session
        const existing = await pool.query(
            'SELECT * FROM absent_requests WHERE student_id = $1 AND date = $2 AND session_id = $3',
            [studentId, date, sessionId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Request already exists for this date' });
        }

        const result = await pool.query(
            `INSERT INTO absent_requests (student_id, institute_id, class, section, date, reason, status, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
            [studentId, instituteId, studentClass, studentSection, date, reason, sessionId]
        );

        res.status(201).json({ message: 'Absent request submitted successfully', request: result.rows[0] });
    } catch (error) {
        console.error('Submit request error:', error);
        res.status(500).json({ message: 'Server error while submitting request' });
    }
};

// Student: Get my requests
const getMyRequests = async (req, res) => {
    try {
        const studentId = req.user.id;
        const sessionId = req.user.current_session_id;

        const result = await pool.query(
            `SELECT * FROM absent_requests 
       WHERE student_id = $1 AND session_id = $2
       ORDER BY date DESC`,
            [studentId, sessionId]
        );

        res.status(200).json({ requests: result.rows });
    } catch (error) {
        console.error('Get my requests error:', error);
        res.status(500).json({ message: 'Server error while fetching requests' });
    }
};

// Student: Update pending request
const updateRequest = async (req, res) => {
    try {
        const studentId = req.user.id;
        const sessionId = req.user.current_session_id;
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ message: 'Reason is required' });
        }

        // Check if request exists and is pending
        const existing = await pool.query(
            'SELECT * FROM absent_requests WHERE id = $1 AND student_id = $2 AND session_id = $3',
            [id, studentId, sessionId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (existing.rows[0].status !== 'pending') {
            return res.status(400).json({ message: 'Cannot edit approved/rejected request' });
        }

        const result = await pool.query(
            `UPDATE absent_requests 
       SET reason = $1, updated_at = NOW() 
       WHERE id = $2 AND session_id = $3
       RETURNING *`,
            [reason, id, sessionId]
        );

        res.status(200).json({ message: 'Request updated successfully', request: result.rows[0] });
    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ message: 'Server error while updating request' });
    }
};

// Student: Delete pending request
const deleteRequest = async (req, res) => {
    try {
        const studentId = req.user.id;
        const sessionId = req.user.current_session_id;
        const { id } = req.params;

        // Check if request exists and is pending
        const existing = await pool.query(
            'SELECT * FROM absent_requests WHERE id = $1 AND student_id = $2 AND session_id = $3',
            [id, studentId, sessionId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (existing.rows[0].status !== 'pending') {
            return res.status(400).json({ message: 'Cannot delete approved/rejected request' });
        }

        await pool.query('DELETE FROM absent_requests WHERE id = $1 AND session_id = $2', [id, sessionId]);

        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Delete request error:', error);
        res.status(500).json({ message: 'Server error while deleting request' });
    }
};

// Teacher: Get requests for specific date/class/section
const getRequestsForDate = async (req, res) => {
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
            `SELECT ar.*, s.name as student_name, s.roll_no 
       FROM absent_requests ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.date = $1 AND ar.class = $2 AND ar.section = $3 AND ar.institute_id = $4 AND ar.session_id = $5
       ORDER BY s.roll_no`,
            [date, className, section, instituteId, sessionId]
        );

        res.status(200).json({ requests: result.rows });
    } catch (error) {
        console.error('Get requests for date error:', error);
        res.status(500).json({ message: 'Server error while fetching requests' });
    }
};

// Teacher: Approve request and mark student absent
const approveRequest = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const { id } = req.params;

        // Get teacher name
        const teacherResult = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
        const teacherName = teacherResult.rows[0]?.name || 'Unknown';

        // Get request details
        const requestResult = await pool.query(
            'SELECT * FROM absent_requests WHERE id = $1 AND institute_id = $2 AND session_id = $3',
            [id, instituteId, sessionId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }

        // Update request status
        await pool.query(
            `UPDATE absent_requests 
       SET status = 'approved', approved_by_teacher_id = $1, approved_by_teacher_name = $2, approved_at = NOW() 
       WHERE id = $3 AND session_id = $4`,
            [teacherId, teacherName, id, sessionId]
        );

        // Mark student absent in attendance table
        await pool.query(
            `INSERT INTO attendance (institute_id, teacher_id, student_id, class, section, date, status, updated_at, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'absent', NOW(), $7)
       ON CONFLICT (student_id, date, session_id) 
       DO UPDATE SET status = 'absent', teacher_id = $2, updated_at = NOW()`,
            [instituteId, teacherId, request.student_id, request.class, request.section, request.date, sessionId]
        );

        res.status(200).json({ message: 'Request approved and student marked absent' });
    } catch (error) {
        console.error('Approve request error:', error);
        res.status(500).json({ message: 'Server error while approving request' });
    }
};

// Staff: Get a specific student's absent requests
const getStudentAbsentRequests = async (req, res) => {
    try {
        const { studentId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        if (!sessionId || sessionId === 'undefined') {
            const sessionResult = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [instituteId]);
            sessionId = sessionResult.rows[0]?.current_session_id;
        }

        const result = await pool.query(
            `SELECT * FROM absent_requests 
             WHERE student_id = $1 AND institute_id = $2 AND session_id = $3
             ORDER BY date DESC`,
            [studentId, instituteId, sessionId]
        );

        res.status(200).json({ requests: result.rows });
    } catch (error) {
        console.error('Get student absent requests error:', error);
        res.status(500).json({ message: 'Server error while fetching requests' });
    }
};

export { submitRequest, getMyRequests, updateRequest, deleteRequest, getRequestsForDate, approveRequest, getStudentAbsentRequests };