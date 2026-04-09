import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { getBrowser } from '../utils/puppeteerManager.js';
import { getBase64Image } from '../utils/imageUtils.js';

// --- Global Concurrency Queue Logic ---
let activeJobs = 0;
const MAX_CONCURRENT_PDFS = 2; // Best for 4GB RAM
const queue = [];

const processQueue = async () => {
    if (activeJobs >= MAX_CONCURRENT_PDFS || queue.length === 0) return;

    activeJobs++;
    const { job, resolve, reject } = queue.shift();

    try {
        const result = await job();
        resolve(result);
    } catch (error) {
        reject(error);
    } finally {
        activeJobs--;
        processQueue(); // Run next job in line
    }
};

const addToQueue = (job) => {
    return new Promise((resolve, reject) => {
        queue.push({ job, resolve, reject });
        processQueue();
    });
};
// ----------------------------------------

export const togglePublishExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_published } = req.body;
        const institute_id = req.user?.institute_id || req.user?.id;

        const result = await pool.query(
            `UPDATE exams SET is_published = $1, updated_at = NOW() 
             WHERE id = $2 AND institute_id = $3 RETURNING *`,
            [is_published, id, institute_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Exam not found or unauthorized' });
        }

        const exam = result.rows[0];

        // If published, notify students
        if (is_published) {
            const students = await pool.query(
                `SELECT push_token FROM students 
                 WHERE institute_id = $1 AND "class" = $2 AND "section" = $3 AND push_token IS NOT NULL AND is_active = true`,
                [institute_id, exam.class_name, exam.section]
            );

            const tokens = students.rows.map(s => s.push_token);
            if (tokens.length > 0) {
                await sendPushNotification(
                    tokens,
                    'Result Published! 📊',
                    `The results for ${exam.name} have been published. Check your marksheet now!`,
                    { type: 'RESULT_PUBLISHED', id: exam.id }
                );

                // Socket Notification: Target each student individually via unique_code room
                const io = req.app.get('io');
                if (io) {
                    const { emitToStudent } = await import('../utils/socket.js');
                    const studentDetails = await pool.query(
                        `SELECT unique_code FROM students 
                         WHERE institute_id = $1 AND "class" = $2 AND "section" = $3 AND is_active = true`,
                        [institute_id, exam.class_name, exam.section]
                    );
                    
                    studentDetails.rows.forEach(s => {
                        if (s.unique_code) {
                            emitToStudent(s.unique_code, 'result_published', {
                                id: exam.id,
                                exam_name: exam.name,
                                title: 'Result Published! 📊',
                                body: `The results for ${exam.name} have been published.`
                            });
                        }
                    });
                }
            }
        }

        res.json(exam);
    } catch (err) {
        console.error('Error toggling publish:', err);
        res.status(500).json({ message: 'Server error toggling publish' });
    }
};

export const getPublishedExams = async (req, res) => {
    try {
        const studentId = req.user.id;
        const institute_id = req.user.institute_id;
        const sessionId = req.user.current_session_id;

        // Get student's class and section
        const studentRes = await pool.query(`SELECT class, section FROM students WHERE id = $1`, [studentId]);
        if (studentRes.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        const { class: className, section } = studentRes.rows[0];

        // Find published exams for this class/section/session
        const exams = await pool.query(
            `SELECT * FROM exams 
             WHERE institute_id = $1 AND class_name = $2 AND section = $3 
             AND session_id = $4 AND is_published = true 
             ORDER BY created_at DESC`,
            [institute_id, className, section, sessionId]
        );

        res.json(exams.rows);
    } catch (err) {
        console.error('Error fetching published exams:', err);
        res.status(500).json({ message: 'Server error fetching exams' });
    }
};

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
            manual_stats,
            evaluation_mode
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
                grading_rules, subjects_blueprint, manual_stats, session_id,
                evaluation_mode
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [
                institute_id, name, session, class_name, section,
                show_highest_marks, include_percentage, include_grade,
                JSON.stringify(grading_rules),
                JSON.stringify(subjects_blueprint), JSON.stringify(manual_stats || {}),
                sessionId,
                evaluation_mode || 'senior'
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
        const instituteRes = await pool.query(`SELECT * FROM institutes WHERE id = $1`, [institute_id]);
        const studentRes = await pool.query(`SELECT * FROM students WHERE id = $1`, [student_id]);

        // 3. Result Data
        const resultRes = await pool.query(
            `SELECT * FROM student_exam_results WHERE exam_id = $1 AND student_id = $2`,
            [exam_id, student_id]
        );

        // 4. Attendance Data (for current session)
        const attendanceRes = await pool.query(
            `SELECT 
                COUNT(*) as total_days,
                COUNT(*) FILTER (WHERE status = 'present') as present_days
             FROM attendance 
             WHERE student_id = $1 AND institute_id = $2`,
            [student_id, institute_id]
        );

        const attendance = attendanceRes.rows[0];
        attendance.percentage = attendance.total_days > 0 ? ((attendance.present_days / attendance.total_days) * 100).toFixed(2) : 0;

        res.json({
            exam: examRes.rows[0],
            student: studentRes.rows[0],
            institute: instituteRes.rows[0],
            result: resultRes.rows[0] || {},
            attendance
        });

    } catch (err) {
        console.error('Error fetching marksheet:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Shared Helper for PDF Generation Logic (OPTIMIZED)
const generatePDFLogic = async (examId, studentIds, instituteId, res) => {
    let page = null;
    try {
        // --- QUEUE WRAPPER ---
        const result = await addToQueue(async () => {
            // 1. Get Exam & Institute Details
            const examResult = await pool.query(
                `SELECT e.*, i.institute_name, i.address, i.district, i.state, i.pincode, i.logo_url, i.affiliation, i.landmark 
                 FROM exams e
                 JOIN institutes i ON e.institute_id = i.id
                 WHERE e.id = $1 AND e.institute_id = $2`,
                [examId, instituteId]
            );
            if (examResult.rows.length === 0) throw new Error('Exam not found');
            const exam = examResult.rows[0];
            const isJunior = exam.evaluation_mode === 'junior';
            const subjects_blueprint = Array.isArray(exam.subjects_blueprint) ? exam.subjects_blueprint : [];
            const manual_stats = exam.manual_stats || {};

            // 2. Fetch selected students data
            const studentsDataRes = await pool.query(
                `SELECT s.*, r.marks_data, r.calculated_stats, r.overall_remark
                 FROM students s
                 LEFT JOIN student_exam_results r ON s.id = r.student_id AND r.exam_id = $1
                 WHERE s.id = ANY($2) AND s.institute_id = $3
                 ORDER BY s.roll_no ASC`,
                [examId, studentIds, instituteId]
            );
            const students = studentsDataRes.rows;

            // --- DATA PRE-OPTIMIZATION (BASE64) ---
            const rawLogo = exam.logo_url;
            const cleanBucketUrl = process.env.EOS_BUCKET_URL?.endsWith('/') ? process.env.EOS_BUCKET_URL.slice(0, -1) : process.env.EOS_BUCKET_URL;
            const logoFullUrl = rawLogo?.startsWith('http') ? rawLogo : (rawLogo ? `${cleanBucketUrl}/${rawLogo}` : null);
            const logoBase64 = await getBase64Image(logoFullUrl);

            // Fetch Student Photos & Attendance in small chunks
            const optimizedStudents = [];
            for (const s of students) {
                const rawPhoto = s.photo_url || s.profile_image;
                const photoFullUrl = rawPhoto?.startsWith('http') ? rawPhoto : (rawPhoto ? `${cleanBucketUrl}/${rawPhoto}` : null);
                
                let photoBase64 = null;
                if (photoFullUrl) {
                    photoBase64 = await getBase64Image(photoFullUrl);
                }

                // Fetch Attendance for each student
                const attRes = await pool.query(
                    `SELECT 
                        COUNT(*) as total_days,
                        COUNT(*) FILTER (WHERE status = 'present') as present_days
                     FROM attendance 
                     WHERE student_id = $1 AND institute_id = $2`,
                    [s.id, instituteId]
                );
                const att = attRes.rows[0] || { total_days: 0, present_days: 0 };
                const att_percent = att.total_days > 0 ? ((att.present_days / att.total_days) * 100).toFixed(2) : 0;

                optimizedStudents.push({ ...s, photoBase64, attendance: { ...att, percentage: att_percent } });
            }

            // 3. Generate HTML Content
            const totalMax = subjects_blueprint.reduce((sum, sub) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);

            let htmlContent = `
                <html>
                <head>
                    <style>
                        @page { size: A4; margin: 0; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                        body { margin: 0; padding: 0; background: #fff; font-family: 'Helvetica', Arial, sans-serif; }
                        .report-card { 
                            width: 210mm; height: 297mm; padding: 12mm; padding-top: 6mm;
                            background: #fff; page-break-after: always; display: flex; flex-direction: column;
                            position: relative; border: 2.5px solid #000; overflow: hidden; margin: 0;
                        }
                        .inner-border { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 0.8px solid #333; pointer-events: none; z-index: 0; }
                        .header { text-align: center; margin-bottom: 10px; z-index: 10; }
                        .inst-row { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 15px; margin-bottom: 0; }
                        .inst-logo { width: 80px; height: 80px; object-fit: contain; }
                        .inst-name { font-size: 28px; white-space: nowrap; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0; line-height: 1; margin-top: -10px; }
                        .inst-affiliation { font-size: 17px; color: #4f46e5; font-weight: 700; margin-top: -27px; margin-bottom: 4px; margin-left: 60px; }
                        .inst-sub { font-size: 13px; color: #444; font-weight: 700; margin-top: 2px; margin-bottom: 8px; line-height: 1.2; margin-left: 26px; }
                        .exam-title-box { display: inline-block; background: #1e1b4b; color: #fff; padding: 6px 35px; border-radius: 4px; margin-top: 5px; transform: skewX(-10deg); font-weight: 900; font-size: 16px; }
                        .student-section { display: flex; flex-direction: row; justify-content: space-between; margin-bottom: 15px; padding: 12px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; }
                        .info-grid { flex: 1; }
                        .info-row { display: flex; border-bottom: 1px solid #cbd5e1; padding: 6px 0; }
                        .info-label { width: 140px; font-size: 10px; font-weight: bold; color: #64748b; }
                        .info-value { flex: 1; font-size: 14px; font-weight: 900; color: #0f172a; }
                        .photo-box { width: 90px; height: 110px; border: 4px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden; background: #eee; }
                        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                        table { width: 100%; border-collapse: collapse; border: 2px solid #1e1b4b; border-radius: 12px; overflow: hidden; margin-bottom: 15px; }
                        th { background: #1e1b4b; color: #fff; padding: 8px; font-size: 11px; font-weight: 900; }
                        td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 13px; font-weight: 800; }
                        .text-left { text-align: left; padding-left: 15px; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        .summary-box { display: flex; flex-direction: row; justify-content: space-between; background: #1e1b4b; padding: 15px; border-radius: 12px; margin-bottom: 15px; color: #fff; }
                        .stat-item { text-align: center; }
                        .stat-label { font-size: 9px; font-weight: bold; color: #94a3b8; margin-bottom: 2px; }
                        .stat-value { font-size: 20px; font-weight: 900; }
                        .medal-row { display: flex; flex-direction: row; gap: 10px; margin-bottom: 15px; }
                        .medal { flex: 1; border: 1.5px solid #4f46e5; background: #f5f3ff; padding: 10px; border-radius: 10px; display: flex; align-items: center; gap: 12px; }
                        .medal-text { font-size: 13px; font-weight: 900; color: #1e1b4b; }
                        .medal-score { font-size: 10px; font-weight: 800; color: #4338ca; }
                        .remarks-box { padding: 10px; background: #fffbeb; border-radius: 10px; border-left: 5px solid #f59e0b; margin-bottom: 10px; }
                        .remark-title { font-size: 10px; font-weight: 900; color: #92400e; margin-bottom: 3px; text-decoration: underline; }
                        .remark-text { font-size: 12px; font-style: italic; color: #451a03; font-weight: 600; line-height: 1.2; }
                        .footer { margin-top: auto; display: flex; flex-direction: row; justify-content: space-between; padding: 0 10px 25px 10px; }
                        .sig-line { border-top: 2.5px solid #1e1b4b; width: 150px; text-align: center; font-size: 10px; font-weight: 900; padding-top: 8px; }
                        
                        /* Junior Mode Styles */
                        .attendance-box { 
                            margin-top: 10px; 
                            background: #f1f5f9; 
                            padding: 12px; 
                            border-radius: 10px; 
                            border: 1px solid #cbd5e1;
                            display: flex;
                            justify-content: space-around;
                            align-items: center;
                        }
                        .att-item { text-align: center; }
                        .att-label { font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; }
                        .att-val { font-size: 15px; font-weight: 900; color: #1e293b; }
                    </style>
                </head>
                <body>
            `;

            for (const s of optimizedStudents) {
                const marks = s.marks_data || [];
                const stats = s.calculated_stats || {};
                
                htmlContent += `
                    <div class="report-card">
                        <div class="inner-border"></div>
                        <div class="header">
                            <div class="inst-row">
                                ${logoBase64 ? `<img src="${logoBase64}" class="inst-logo" />` : ''}
                                <h1 class="inst-name">${exam.institute_name}</h1>
                            </div>
                            ${exam.affiliation ? `<p class="inst-affiliation">${exam.affiliation}</p>` : ''}
                            <p class="inst-sub" style="margin-top: 0;">${exam.address || ''} ${exam.landmark || ''} ${exam.district || ''} ${exam.state || ''} ${exam.pincode || ''}</p>
                            <div class="exam-title-box">${exam.name}</div>
                        </div>
                        <div class="student-section">
                            <div class="info-grid">
                                <div class="info-row"><div class="info-label">STUDENT NAME</div><div class="info-value">${s.name}</div></div>
                                <div class="info-row"><div class="info-label">CLASS & SECTION</div><div class="info-value">${s.class} - ${s.section}</div></div>
                                <div class="info-row"><div class="info-label">ROLL NUMBER</div><div class="info-value">${s.roll_no}</div></div>
                                <div class="info-row"><div class="info-label">FATHER'S NAME</div><div class="info-value">${s.father_name}</div></div>
                                <div class="info-row"><div class="info-label">MOTHER'S NAME</div><div class="info-value">${s.mother_name || '-'}</div></div>
                                <div class="info-row"><div class="info-label">DATE OF BIRTH</div><div class="info-value">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '-'}</div></div>
                            </div>
                            <div class="photo-box">${s.photoBase64 ? `<img src="${s.photoBase64}" />` : '<span style="font-size: 10px; color: #999; display: flex; align-items: center; justify-content: center; height: 100%;">PHOTO</span>'}</div>
                        </div>
                        
                        ${isJunior ? `
                            <table>
                                <thead><tr><th class="text-left" style="width: 70%;">ASSESSMENT INDICATOR / SKILLS</th><th style="width: 30%;">GRADE / PERFORMANCE</th></tr></thead>
                                <tbody>
                                    ${subjects_blueprint.map(sub => {
                                        const marksData = marks.find(mk => mk.subject === sub.name) || {};
                                        return `<tr><td class="text-left" style="color: #1e293b; font-weight: 900;">${sub.name}</td><td style="color: #4f46e5; font-size: 15px; font-weight: 900;">${marksData.grade || '-'}</td></tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        ` : `
                            <table>
                                <thead><tr><th class="text-left">SUBJECT</th><th>MAX</th><th>PASS</th><th>OBT</th>${exam.show_highest_marks ? '<th>HIGH</th>' : ''}<th>GRADE</th></tr></thead>
                                <tbody>
                                    ${subjects_blueprint.map(sub => {
                                        const marksData = marks.find(mk => mk.subject === sub.name) || {};
                                        return `<tr><td class="text-left" style="color: #1e293b;">${sub.name}</td><td>${(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</td><td>${sub.passing_marks || '-'}</td><td style="color: #4f46e5; font-size: 12px; font-weight: 900;">${marksData.theory || '-'}</td>${exam.show_highest_marks ? `<td style="color: #6366f1;">${manual_stats[`highest_${sub.name}`] || '-'}</td>` : ''}<td style="font-weight: 900;">${marksData.grade || '-'}</td></tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                            <div class="summary-box">
                                <div class="stat-item"><div class="stat-label">GRAND TOTAL</div><div class="stat-value">${stats.total || 0} / ${totalMax}</div></div>
                                <div class="stat-item"><div class="stat-label">PERCENTAGE</div><div class="stat-value">${stats.percentage || 0}%</div></div>
                                <div class="stat-item"><div class="stat-label">FINAL GRADE</div><div class="stat-value" style="color: #fbbf24;">${stats.grade || '-'}</div></div>
                            </div>
                        `}

                        <div class="remarks-box"><div class="remark-title">OFFICIAL REMARKS</div><div class="remark-text">"${s.overall_remark || 'Satisfactory performance. Aim for higher goals in the next academic term.'}"</div></div>

                        ${isJunior ? `
                            <div class="attendance-box">
                                <div class="att-item"><div class="att-label">Total Days</div><div class="att-val">${s.attendance.total_days}</div></div>
                                <div class="att-item"><div class="att-label">Days Present</div><div class="att-val">${s.attendance.present_days}</div></div>
                                <div class="att-item"><div class="att-label">Attendance %</div><div class="att-val">${s.attendance.percentage}%</div></div>
                            </div>
                        ` : ''}

                        ${!isJunior && (manual_stats.section_topper_name || manual_stats.class_topper_name) ? `<div class="medal-row" style="margin-top: 10px;">${manual_stats.section_topper_name ? `<div class="medal"><div style="font-size: 24px;">🏆</div><div><div class="medal-text">Section Topper: ${manual_stats.section_topper_name}</div><div class="medal-score">Score: ${manual_stats.section_topper_total} / ${totalMax}</div></div></div>` : ''}${manual_stats.class_topper_name ? `<div class="medal"><div style="font-size: 24px;">🎖️</div><div><div class="medal-text">Class Topper: ${manual_stats.class_topper_name}</div><div class="medal-score">Score: ${manual_stats.class_topper_total} / ${totalMax}</div></div></div>` : ''}</div>` : ''}
                        
                        <div class="footer">
                            <div class="sig-line">CLASS TEACHER'S SIGNATURE</div>
                            <div class="sig-line">PRINCIPAL'S SIGNATURE</div>
                        </div>
                    </div>
                `;
            }
            htmlContent += `</body></html>`;

            const browser = await getBrowser();
            page = await browser.newPage();
            
            // Fast loading because all data is local (Base64 + HTML)
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            
            const pdfBuffer = await page.pdf({ 
                format: 'A4', 
                printBackground: true, 
                timeout: 60000, 
                margin: { top: 0, right: 0, bottom: 0, left: 0 } 
            });

            return pdfBuffer;
        });

        res.set({ 
            'Content-Type': 'application/pdf', 
            'Content-Length': result.length, 
            'Content-Disposition': `attachment; filename="marksheet.pdf"` 
        });
        res.send(result);

    } catch (err) {
        console.error('PDF Generation Error:', err.message);
        res.status(500).json({ message: 'Server error generating PDF' });
    } finally {
        if (page) await page.close(); // Crucial: Always close page to free RAM
    }
};

export const generateBulkPDF = async (req, res) => {
    const { id } = req.params;
    const { studentIds } = req.body;
    const instituteId = req.user?.institute_id || req.user?.id;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) return res.status(400).json({ message: 'No students selected' });
    await generatePDFLogic(id, studentIds, instituteId, res);
};

export const generateStudentPDF = async (req, res) => {
    const { id } = req.params; // examId
    const studentId = req.user.id;
    const instituteId = req.user.institute_id;
    
    // Check if result is published before allowing download
    const checkPublish = await pool.query(`SELECT is_published FROM exams WHERE id = $1`, [id]);
    if (!checkPublish.rows[0]?.is_published) {
        return res.status(403).json({ message: 'Results for this exam are not published yet.' });
    }

    await generatePDFLogic(id, [studentId], instituteId, res);
};

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
