import pool from '../config/db.js';

// Add Event
export const addEvent = async (req, res) => {
    try {
        const { title, description, event_date, event_type } = req.body;
        const instituteId = req.user.institute_id;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!title || !event_date) {
            return res.status(400).json({ message: 'Title and date are required' });
        }

        const result = await pool.query(
            `INSERT INTO academic_calendar (institute_id, title, description, event_date, event_type, session_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, institute_id, title, description, TO_CHAR(event_date, 'YYYY-MM-DD') as event_date, event_type, created_at, session_id`,
            [instituteId, title, description, event_date, event_type || 'event', sessionId]
        );

        res.status(201).json({ message: 'Event added successfully', event: result.rows[0] });
    } catch (error) {
        console.error('Add event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Events
export const getEvents = async (req, res) => {
    try {
        const instituteId = req.user.institute_id;
        const sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;
        // Optional: Filter by month/year if needed, but for now we'll fetch all and filter on client
        // or we can accept query params
        const { month, year } = req.query;

        let query = `SELECT id, institute_id, title, description, TO_CHAR(event_date, 'YYYY-MM-DD') as event_date, event_type, created_at, session_id FROM academic_calendar WHERE institute_id = $1 AND session_id = $2`;
        let params = [instituteId, sessionId];

        if (month && year) {
            query += ` AND EXTRACT(MONTH FROM event_date) = $3 AND EXTRACT(YEAR FROM event_date) = $4`;
            params.push(parseInt(month), parseInt(year));
        }

        query += ` ORDER BY event_date ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete Event
export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const instituteId = req.user.institute_id;

        const result = await pool.query(
            `DELETE FROM academic_calendar WHERE id = $1 AND institute_id = $2 RETURNING *`,
            [id, instituteId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found or unauthorized' });
        }

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
