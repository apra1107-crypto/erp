import express from 'express';
import pool from '../config/db.js';
import { protect, principalOrSpecialTeacher } from '../middlewares/auth.js';

const router = express.Router();

// Get all sessions for an institute (Anyone logged in can view)
router.get('/', protect, async (req, res) => {
    try {
        const institute_id = req.user.institute_id || req.user.id; // Principal's ID is the institute_id in some contexts
        
        const sessions = await pool.query(
            'SELECT * FROM academic_sessions WHERE institute_id = $1 ORDER BY created_at DESC',
            [institute_id]
        );
        
        res.json(sessions.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new session
router.post('/', protect, principalOrSpecialTeacher, async (req, res) => {
    const { name } = req.body;
    try {
        const institute_id = req.user.institute_id || req.user.id;

        // Deactivate all other sessions if this one is set to active (optional logic)
        // For now, just create it
        const newSession = await pool.query(
            'INSERT INTO academic_sessions (institute_id, name, is_active) VALUES ($1, $2, $3) RETURNING *',
            [institute_id, name, false]
        );

        res.status(201).json(newSession.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update session (e.g., rename)
router.put('/:id', protect, principalOrSpecialTeacher, async (req, res) => {
    const { name, is_active } = req.body;
    const { id } = req.params;
    try {
        const institute_id = req.user.institute_id || req.user.id;

        if (is_active) {
            // If setting this one to active, deactivate others for this institute
            await pool.query(
                'UPDATE academic_sessions SET is_active = false WHERE institute_id = $1',
                [institute_id]
            );
            
            // Also update the institute's current_session_id
            await pool.query(
                'UPDATE institutes SET current_session_id = $1 WHERE id = $2',
                [id, institute_id]
            );
        }

        const updatedSession = await pool.query(
            'UPDATE academic_sessions SET name = COALESCE($1, name), is_active = COALESCE($2, is_active) WHERE id = $3 AND institute_id = $4 RETURNING *',
            [name, is_active, id, institute_id]
        );

        res.json(updatedSession.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete academic session
router.delete('/:id', protect, principalOrSpecialTeacher, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const institute_id = req.user.institute_id || req.user.id;

        // 1. Check if session exists and belongs to institute
        const sessionCheck = await client.query(
            'SELECT * FROM academic_sessions WHERE id = $1 AND institute_id = $2',
            [id, institute_id]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        const session = sessionCheck.rows[0];

        // 2. Prevent deleting the active session
        if (session.is_active) {
            return res.status(400).json({ message: 'Cannot delete the currently active academic session' });
        }

        await client.query('BEGIN');

        // 3. Handle Special Cases (Child tables that don't have session_id but link to tables that do)
        // These MUST be deleted first to avoid Foreign Key violations
        
        const tableExists = async (name) => {
            const res = await client.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
                [name]
            );
            return res.rows[0].exists;
        };

        // A. Homework Completions (linked to homework)
        if (await tableExists('homework_completions')) {
            await client.query(`
                DELETE FROM homework_completions 
                WHERE homework_id IN (SELECT id FROM homework WHERE session_id = $1)
            `, [id]);
        }

        // B. Exam Results (linked to exams)
        if (await tableExists('exam_results')) {
            await client.query(`
                DELETE FROM exam_results 
                WHERE exam_id IN (SELECT id FROM exams WHERE session_id = $1)
            `, [id]);
        }

        // C. Fee Payments (linked to fee records)
        // Check both monthly and occasional
        if (await tableExists('fee_payments')) {
             await client.query(`
                DELETE FROM fee_payments 
                WHERE (monthly_fee_id IN (SELECT id FROM student_monthly_fees WHERE session_id = $1))
                OR (occasional_fee_id IN (SELECT id FROM student_occasional_fees WHERE session_id = $1))
            `, [id]);
        }

        // 4. Dynamically find all tables that have a session_id column
        const tableScanRes = await client.query(`
            SELECT table_name 
            FROM information_schema.columns 
            WHERE column_name = 'session_id' 
            AND table_schema = 'public'
        `);

        // Sort tables to handle dependencies (Students and Exams should usually be last among session-bound tables)
        const tablesWithSessionId = tableScanRes.rows.map(r => r.table_name);
        
        // We want to delete from "logs/records" tables before "main" tables like students
        const priorityTables = ['attendance', 'teacher_self_attendance', 'notices', 'academic_calendar', 'class_routines', 'homework', 'exams', 'admit_cards', 'student_monthly_fees', 'student_occasional_fees'];
        
        // Sort: Priority tables first, then others, then students last
        const sortedTables = tablesWithSessionId.sort((a, b) => {
            if (a === 'students') return 1;
            if (b === 'students') return -1;
            const aIdx = priorityTables.indexOf(a);
            const bIdx = priorityTables.indexOf(b);
            if (aIdx !== -1 && bIdx === -1) return -1;
            if (aIdx === -1 && bIdx !== -1) return 1;
            return 0;
        });

        for (const table of sortedTables) {
            if (table === 'academic_sessions') continue;
            try {
                await client.query(`DELETE FROM ${table} WHERE session_id = $1`, [id]);
            } catch (tableErr) {
                console.error(`Error deleting from table ${table}:`, tableErr.message);
                throw tableErr;
            }
        }

        // 5. Finally delete the session itself
        await client.query(
            'DELETE FROM academic_sessions WHERE id = $1 AND institute_id = $2',
            [id, institute_id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Session and all associated data deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete session error:', err);
        res.status(500).json({ message: 'Server error deleting session' });
    } finally {
        client.release();
    }
});

export default router;
