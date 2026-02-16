import pool from '../config/db.js';

export const createExam = async (req, res) => {
    try {
        const {
            name,
            session,
            class_name,
            section,
            subjects_blueprint,
            grading_rules,
            show_highest_marks,
            include_percentage,
            include_grade,
            manual_stats
        } = req.body;

        // Basic validation
        if (!name || !class_name || !section) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;

        const newExam = await pool.query(
            `INSERT INTO exams (
                institute_id, name, session, class_name, section, 
                show_highest_marks, include_percentage, include_grade,
                grading_rules, subjects_blueprint, manual_stats, session_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                institute_id, name, session, class_name, section,
                show_highest_marks, include_percentage, include_grade,
                JSON.stringify(grading_rules),
                JSON.stringify(subjects_blueprint), JSON.stringify(manual_stats || {}),
                sessionId
            ]
        );

        res.status(201).json(newExam.rows[0]);
    } catch (err) {
        console.error('Error creating exam:', err);
        res.status(500).json({ message: 'Server error creating exam' });
    }
};

export const getExams = async (req, res) => {
    try {
        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;
        const exams = await pool.query(
            `SELECT * FROM exams WHERE institute_id = $1 AND session_id = $2 ORDER BY created_at DESC`,
            [institute_id, sessionId]
        );
        res.json(exams.rows);
    } catch (err) {
        console.error('Error fetching exams:', err);
        res.status(500).json({ message: 'Server error fetching exams' });
    }
};

export const deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;

        // Verify ownership before delete (security)
        const check = await pool.query(`SELECT id FROM exams WHERE id = $1 AND institute_id = $2 AND session_id = $3`, [id, institute_id, sessionId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        await pool.query(`DELETE FROM exams WHERE id = $1`, [id]);
        res.json({ message: 'Exam deleted successfully' });
    } catch (err) {
        console.error('Error deleting exam:', err);
        res.status(500).json({ message: 'Server error deleting exam' });
    }
};

export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;
        const exam = await pool.query(`SELECT * FROM exams WHERE id = $1`, [id]);

        if (exam.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found' });
        }

        res.json(exam.rows[0]);
    } catch (err) {
        console.error('Error fetching exam:', err);
        res.status(500).json({ message: 'Server error fetching exam' });
    }
};

export const updateExamStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { manual_stats } = req.body;

        await pool.query(
            `UPDATE exams SET manual_stats = $1 WHERE id = $2`,
            [JSON.stringify(manual_stats), id]
        );
        res.json({ message: 'Stats updated' });
    } catch (err) {
        console.error('Error updating stats:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// This is the core "Excel Grid" loader
export const getExamStudents = async (req, res) => {
    try {
        const { id } = req.params;
        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;

        // 1. Get Exam Details to know Class/Section + Institute Branding
        const examResult = await pool.query(
            `SELECT e.*, i.institute_name, i.address, i.district, i.state, i.pincode, i.logo_url, i.affiliation 
             FROM exams e
             JOIN institutes i ON e.institute_id = i.id
             WHERE e.id = $1 AND e.session_id = $2`,
            [id, sessionId]
        );
        if (examResult.rows.length === 0) return res.status(404).json({ message: 'Exam not found' });
        const exam = examResult.rows[0];

        // 2. Fetch all students in this Class/Section for this session
        // We use "class" in quotes to avoid keyword collisions and ensure we only get active students
        const students = await pool.query(
            `SELECT id, name, roll_no, class, section, father_name, mother_name, mobile, dob, photo_url as profile_image 
             FROM students 
             WHERE institute_id = $1 AND "class" = $2 AND "section" = $3 AND is_active = true AND session_id = $4
             ORDER BY roll_no ASC`,
            [institute_id, exam.class_name, exam.section, sessionId]
        );

        // 3. Fetch existing results for this exam
        const results = await pool.query(
            `SELECT * FROM student_exam_results WHERE exam_id = $1`,
            [id]
        );

        // 4. Merge Data: Return list of students WITH their marks (if any)
        const gridData = students.rows.map(std => {
            const existingResult = results.rows.find(r => r.student_id === std.id);
            return {
                student: std,
                marks_data: existingResult ? existingResult.marks_data : [], // Empty if new
                overall_remark: existingResult ? existingResult.overall_remark : '',
                calculated_stats: existingResult ? existingResult.calculated_stats : {},
                result_id: existingResult ? existingResult.id : null
            };
        });

        res.json({ exam, students: gridData });

    } catch (err) {
        console.error('Error fetching exam students:', err);
        res.status(500).json({ message: 'Server error fetching students' });
    }
};

// Batch update or Single Student update
export const saveStudentMarks = async (req, res) => {
    try {
        const { exam_id } = req.params;
        const { student_id, marks_data, overall_remark, calculated_stats } = req.body;
        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;

        // Upsert Logic (Insert or Update)
        // Using ON CONFLICT logic if available, or manual check

        // Check if exists
        const check = await pool.query(
            `SELECT id FROM student_exam_results WHERE exam_id = $1 AND student_id = $2 AND session_id = $3`,
            [exam_id, student_id, sessionId]
        );

        if (check.rows.length > 0) {
            // Update
            await pool.query(
                `UPDATE student_exam_results 
                 SET marks_data = $1, overall_remark = $2, calculated_stats = $3, updated_at = NOW()
                 WHERE exam_id = $4 AND student_id = $5 AND session_id = $6`,
                [JSON.stringify(marks_data), overall_remark, JSON.stringify(calculated_stats), exam_id, student_id, sessionId]
            );
        } else {
            // Insert
            await pool.query(
                `INSERT INTO student_exam_results 
                 (exam_id, student_id, institute_id, marks_data, overall_remark, calculated_stats, session_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [exam_id, student_id, institute_id, JSON.stringify(marks_data), overall_remark, JSON.stringify(calculated_stats), sessionId]
            );
        }

        res.json({ message: 'Saved successfully' });

    } catch (err) {
        console.error('Error saving marks:', err);
        res.status(500).json({ message: 'Server error saving marks' });
    }
};

// Get Full Marksheet Data for a Single Student (for the Template)
export const getStudentMarksheet = async (req, res) => {
    try {
        const { exam_id, student_id } = req.params;
        const institute_id = req.user?.institute_id;

        // 1. Exam Blueprint
        const examRes = await pool.query(`SELECT * FROM exams WHERE id = $1`, [exam_id]);
        if (examRes.rows.length === 0) return res.status(404).json({ message: 'Exam not found' });

        // 2. Student Data (Detailed)
        // We need institute details too? Usually stored in institute table or user session.
        // Let's fetch institute details for the Header
        const instituteRes = await pool.query(`SELECT * FROM institutes WHERE id = $1`, [institute_id]);

        const studentRes = await pool.query(`SELECT * FROM students WHERE id = $1`, [student_id]);

        // 3. Result Data
        const resultRes = await pool.query(
            `SELECT * FROM student_exam_results WHERE exam_id = $1 AND student_id = $2`,
            [exam_id, student_id]
        );

        res.json({
            exam: examRes.rows[0],
            student: studentRes.rows[0],
            institute: instituteRes.rows[0],
            result: resultRes.rows[0] || {} // Empty object if no result yet
        });

    } catch (err) {
        console.error('Error fetching marksheet:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Helper for autocomplete in stats modal
export const getClassStudents = async (req, res) => {
    try {
        const { class_name } = req.query; // Passed as query param
        const institute_id = req.user?.institute_id || req.user?.id;
        const sessionId = req.user.current_session_id;

        if (!class_name) return res.json([]);

        // Fetch ALL students for this class, across all sections for current session
        const students = await pool.query(
            `SELECT id, name, section FROM students WHERE institute_id = $1 AND "class" = $2 AND is_active = true AND session_id = $3 ORDER BY name`,
            [institute_id, class_name, sessionId]
        );
        res.json(students.rows);
    } catch (err) {
        console.error('Error fetching class students:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
