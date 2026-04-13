import pool from '../config/db.js';
import { sendPushNotification } from '../utils/pushNotification.js';
import { getBrowser } from '../utils/puppeteerManager.js';
import { getBase64Image } from '../utils/imageUtils.js';

// --- Global Concurrency Queue Logic (Shared with Exam) ---
let activeJobs = 0;
const MAX_CONCURRENT_PDFS = 5; 
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
        processQueue();
    }
};

const addToQueue = (job) => {
    return new Promise((resolve, reject) => {
        queue.push({ job, resolve, reject });
        processQueue();
    });
};
// ---------------------------------------------------------

// Shared Helper for Admit Card PDF Generation (OPTIMIZED)
const generateAdmitCardPDFLogic = async (eventId, studentIds, instituteId, res) => {
    let page = null;
    try {
        const pdfBuffer = await addToQueue(async () => {
            // 1. Get Event & Institute Details
            const eventRes = await pool.query(
                `SELECT a.*, i.institute_name, i.address as institute_address, i.district, i.state, i.pincode, i.logo_url as institute_logo, i.affiliation, i.landmark 
                 FROM admit_cards a
                 JOIN institutes i ON a.institute_id = i.id
                 WHERE a.id = $1 AND a.institute_id = $2`,
                [eventId, instituteId]
            );
            if (eventRes.rows.length === 0) throw new Error('Exam event not found');
            const event = eventRes.rows[0];

            // 2. Fetch selected students data
            const studentsDataRes = await pool.query(
                `SELECT * FROM students 
                 WHERE id = ANY($1) AND institute_id = $2
                 ORDER BY class, section, roll_no ASC`,
                [studentIds, instituteId]
            );
            const students = studentsDataRes.rows;

            // --- IMAGE OPTIMIZATION (BASE64) ---
            const rawLogo = event.institute_logo;
            const cleanBucketUrl = process.env.EOS_BUCKET_URL?.endsWith('/') ? process.env.EOS_BUCKET_URL.slice(0, -1) : process.env.EOS_BUCKET_URL;
            const logoFullUrl = rawLogo?.startsWith('http') ? rawLogo : (rawLogo ? `${cleanBucketUrl}/${rawLogo}` : null);
            const logoBase64 = await getBase64Image(logoFullUrl);

            // Fetch Student Photos in Parallel (MUCH FASTER)
            const optimizedStudents = await Promise.all(students.map(async (s) => {
                const rawPhoto = s.photo_url || s.profile_image;
                const photoFullUrl = rawPhoto?.startsWith('http') ? rawPhoto : (rawPhoto ? `${cleanBucketUrl}/${rawPhoto}` : null);
                
                let photoBase64 = null;
                if (photoFullUrl) {
                    photoBase64 = await getBase64Image(photoFullUrl);
                }
                return { ...s, photoBase64 };
            }));

            // 3. Generate HTML Content (Matched exactly to Requested UI)
            let htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @page { size: A4; margin: 0; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                        body { 
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                            padding: 0; 
                            margin: 0; 
                            color: #333; 
                            background: #f0f0f0; 
                        }
                        
                        .page-container {
                            width: 230mm;
                            height: 324mm;
                            padding: 10mm;
                            box-sizing: border-box;
                            page-break-after: always;
                            display: flex;
                            flex-direction: column;
                            background: #fff;
                            margin: 0 auto;
                            position: relative;
                        }

                        /* A4 Page Border */
                        .page-border {
                            position: absolute;
                            top: 10mm;
                            left: 10mm;
                            right: 10mm;
                            bottom: 10mm;
                            border: 2px solid #000;
                            pointer-events: none;
                            z-index: 10;
                        }

                        .content-wrapper {
                            position: relative;
                            z-index: 5;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            padding: 5mm;
                        }
                        
                        .header-container { 
                            display: flex; 
                            flex-direction: row; 
                            align-items: center; 
                            justify-content: center; 
                            margin-bottom: 5px; 
                            gap: 20px;
                        }
                        
                        .logo { 
                            width: 80px; 
                            height: 80px; 
                            object-fit: contain;
                        }
                        
                        .institute-info { 
                            text-align: center; 
                        }
                        
                        .institute-name { 
                            font-size: 28px; 
                            font-weight: 900; 
                            color: #1A237E; 
                            margin: 0; 
                            text-transform: uppercase; 
                            letter-spacing: 1px; 
                        }
                        
                        .affiliation-text { 
                            font-size: 18px; 
                            color: #000000; 
                            margin: 4px 0 0 2px; 
                            font-weight: 700; 
                        }
                        
                        .address-text { 
                            font-size: 18px; 
                            color: #000000; 
                            margin-top: 4px;
                            margin-left: 2px; 
                            font-weight: 600; 
                            text-align: center; 
                        }
                        
                        .divider { 
                            height: 2px; 
                            background-color: #000; 
                            margin: 15px 0; 
                        }
                        
                        .exam-box { 
                            font-size: 22px; 
                            font-weight: 900; 
                            text-align: center; 
                            margin: 0px auto 10px auto; /* Moved up further */
                            text-transform: uppercase; 
                            padding: 8px 45px; 
                            border: 2.5px solid #000; 
                            display: table; 
                        }
                        
                        .details-section { 
                            display: flex; 
                            flex-direction: row; 
                            justify-content: space-between; 
                            margin: 20px 0; /* Reduced margin */
                            align-items: flex-start;
                        }
                        
                        .info-table { 
                            width: 70%; 
                            border-collapse: collapse; 
                        }
                        
                        .info-table td { 
                            padding: 10px 0; 
                            font-size: 15px; 
                            border-bottom: 1px solid #eee; 
                        }
                        
                        .label { 
                            font-weight: bold; 
                            width: 150px; 
                            color: #555; 
                            font-size: 12px; 
                            text-transform: uppercase;
                        }
                        
                        .value { 
                            font-weight: 900; 
                            color: #000; 
                            font-size: 16px; 
                        }
                        
                        .photo-box { 
                            width: 130px; 
                            height: 160px; 
                            border: 2.5px solid #000; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: #fff; 
                            overflow: hidden; 
                        }
                        
                        .photo-box img { 
                            width: 100%; 
                            height: 100%; 
                            object-fit: cover; 
                        }
                        
                        .timetable-section { 
                            width: 100%; 
                            margin-top: 10px; 
                        }
                        
                        .section-title { 
                            font-weight: 900; 
                            text-decoration: underline; 
                            font-size: 14px; 
                            margin-bottom: 12px; 
                            color: #000;
                        }
                        
                        table.schedule { 
                            width: 100%; 
                            border-collapse: collapse; 
                            border: 2px solid #000; 
                        }
                        
                        .schedule th { 
                            background-color: #f8f9fa; 
                            border: 1.5px solid #000; 
                            padding: 12px; 
                            text-align: left; 
                            font-size: 13px; 
                            font-weight: 900; 
                            text-transform: uppercase;
                        }
                        
                        .schedule td { 
                            border: 1.5px solid #000; 
                            padding: 10px; 
                            font-size: 13px; 
                            font-weight: bold; 
                            color: #000;
                        }
                        
                        .instructions { 
                            border: 2px solid #000; 
                            padding: 15px; 
                            border-radius: 4px; 
                            margin-top: 20px; /* Reduced margin */
                            background: #fafafa; 
                        }
                        
                        .inst-title { 
                            font-weight: 900; 
                            font-size: 13px; 
                            text-decoration: underline; 
                            margin-bottom: 8px; 
                        }
                        
                        .inst-list { 
                            font-size: 12px; 
                            font-weight: bold; 
                            margin: 0; 
                            padding-left: 20px; 
                            line-height: 1.5; 
                        }
                        
                        .signature-section { 
                            margin-top: auto; 
                            padding-top: 30px; /* Reduced padding */
                            display: flex; 
                            justify-content: space-between; 
                            padding-bottom: 20px; 
                        }
                        
                        .sig-line { 
                            border-top: 2px solid #000; 
                            width: 200px; 
                            text-align: center; 
                            font-size: 12px; 
                            font-weight: 900; 
                            padding-top: 8px; 
                            text-transform: uppercase; 
                        }
                    </style>
                </head>
                <body>
            `;

            for (const s of optimizedStudents) {
                const fullAddress = [
                    event.institute_address,
                    event.landmark,
                    event.district,
                    event.state,
                    event.pincode
                ].filter(Boolean).join(', ');

                htmlContent += `
                    <div class="page-container">
                        <div class="page-border"></div>
                        <div class="content-wrapper">
                            <div class="header-container">
                                ${logoBase64 ? `<img src="${logoBase64}" class="logo" />` : ''}
                                <div class="institute-info">
                                    <h1 class="institute-name">${event.institute_name.toUpperCase()}</h1>
                                    ${event.affiliation ? `<p class="affiliation-text">${event.affiliation}</p>` : ''}
                                    <p class="address-text">${fullAddress}</p>
                                </div>
                            </div>

                            <div class="divider"></div>
                            
                            <div class="exam-box">${event.exam_name}</div>

                            <div class="details-section">
                                <table class="info-table">
                                    <tr><td class="label">Student Name</td><td class="value">${s.name}</td></tr>
                                    <tr><td class="label">Class & Section</td><td class="value">${s.class} - ${s.section}</td></tr>
                                    <tr><td class="label">Roll Number</td><td class="value">${s.roll_no || 'TBD'}</td></tr>
                                    <tr><td class="label">Date of Birth</td><td class="value">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : 'N/A'}</td></tr>
                                    <tr><td class="label">Father's Name</td><td class="value">${s.father_name}</td></tr>
                                    <tr><td class="label">Contact Number</td><td class="value">${s.mobile || 'N/A'}</td></tr>
                                </table>
                                <div class="photo-box">
                                    ${s.photoBase64 ? `<img src="${s.photoBase64}" />` : '<div style="font-size:10px;color:#999;font-weight:bold;text-align:center;">AFFIX PHOTO</div>'}
                                </div>
                            </div>

                            <div class="timetable-section">
                                <div class="section-title">EXAMINATION TIMETABLE</div>
                                <table class="schedule">
                                    <thead>
                                        <tr>
                                            <th style="width:30%">Date & Day</th>
                                            <th style="width:40%">Subject Name</th>
                                            <th style="width:30%">Time / Shift</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(event.schedule || []).map(row => `
                                            <tr>
                                                <td>${new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} (${row.day})</td>
                                                <td>${row.subject}</td>
                                                <td>${row.time}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <div class="instructions">
                                <div class="inst-title">IMPORTANT INSTRUCTIONS:</div>
                                <ol class="inst-list">
                                    <li>Candidate must carry this Admit Card to the examination hall for all sessions.</li>
                                    <li>Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</li>
                                    <li>Candidates must report at the examination center at least 20 minutes before time.</li>
                                    <li>The card must be signed by the invigilator during every examination session.</li>
                                </ol>
                            </div>

                            <div class="signature-section">
                                <div class="sig-line">TEACHER'S SIGNATURE</div>
                                <div class="sig-line">PRINCIPAL'S SIGNATURE</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            htmlContent += `</body></html>`;

            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            
            return await page.pdf({ 
                format: 'A4', 
                printBackground: true, 
                timeout: 120000, 
                margin: { top: 0, right: 0, bottom: 0, left: 0 } 
            });
        });

        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length, 'Content-Disposition': `attachment; filename="admit_cards.pdf"` });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Admit Card PDF Error:', err.message);
        res.status(500).json({ message: 'Server error generating PDF' });
    } finally {
        if (page) await page.close();
    }
};

export const generateBulkAdmitCardPDF = async (req, res) => {
    const { id } = req.params; // Event ID
    const { studentIds } = req.body;
    const instituteId = req.user?.institute_id || req.user?.id;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ message: 'No students selected' });
    }

    await generateAdmitCardPDFLogic(id, studentIds, instituteId, res);
};

export const generateStudentAdmitCardPDF = async (req, res) => {
    try {
        const { id } = req.params; // Event ID
        const studentId = req.user.id;
        const instituteId = req.user.institute_id;

        // Verify if it's published
        const check = await pool.query('SELECT is_published FROM admit_cards WHERE id = $1', [id]);
        if (check.rowCount === 0) return res.status(404).json({ message: 'Event not found' });
        if (!check.rows[0].is_published) return res.status(403).json({ message: 'Admit card not published yet' });

        await generateAdmitCardPDFLogic(id, [studentId], instituteId, res);
    } catch (error) {
        console.error('[AdmitCard] Student PDF Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createAdmitCard = async (req, res) => {
    try {
        const { exam_name, classes, schedule } = req.body;
        const teacher_id = (req.user.type === 'teacher' || req.user.role === 'teacher') ? req.user.id : null;
        const institute_id = req.user.institute_id || req.user.id;
        let sessionId = req.headers['x-academic-session-id'] || req.user.current_session_id;

        if (!sessionId || sessionId === 'null' || sessionId === 'undefined') {
            const sessionRes = await pool.query('SELECT current_session_id FROM institutes WHERE id = $1', [institute_id]);
            sessionId = sessionRes.rows[0]?.current_session_id;
        }

        let result;
        // Attempt 1: Full insert
        try {
            result = await pool.query(
                `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule, session_id, is_published)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule), sessionId, false]
            );
        } catch (err1) {
            try {
                result = await pool.query(
                    `INSERT INTO admit_cards (teacher_id, institute_id, exam_name, classes, schedule, session_id)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [teacher_id, institute_id, exam_name, JSON.stringify(classes), JSON.stringify(schedule), sessionId]
                );
            } catch (err2) {
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
                // Silently try next attempt
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
            try {
                result = await pool.query(
                    `SELECT * FROM admit_cards 
                     WHERE institute_id = $1 
                     ORDER BY created_at DESC`,
                    [institute_id]
                );
                return res.status(200).json(result.rows.map(r => ({ ...r, is_published: false })));
            } catch (err3) {
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

            const admitCard = result.rows[0];

            // Notify students if published
            if (is_published) {
                const classes = admitCard.classes || []; // array of {class, section}
                if (classes.length > 0) {
                    // Fetch all student tokens for these classes
                    let query = `SELECT push_token, class, section FROM students 
                                 WHERE institute_id = $1 AND push_token IS NOT NULL AND is_active = true AND (`;
                    
                    const params = [instituteId];
                    const conditions = classes.map((cs, idx) => {
                        params.push(cs.class, cs.section);
                        return `("class" = $${params.length - 1} AND "section" = $${params.length})`;
                    });
                    
                    query += conditions.join(' OR ') + ')';
                    
                    const studentsResult = await pool.query(query, params);
                    const tokens = studentsResult.rows.map(s => s.push_token);

                    if (tokens.length > 0) {
                        const title = 'Admit Card Published! 🪪';
                        const body = `Your admit card for ${admitCard.exam_name} is now available. Download it from the app.`;
                        
                        await sendPushNotification(tokens, title, body, { 
                            type: 'admit-card', 
                            id: admitCard.id 
                        });

                        // Socket Notifications: Target each student individually via unique_code room
                        const io = req.app.get('io');
                        if (io) {
                            const { emitToStudent } = await import('../utils/socket.js');
                            // Re-use studentsResult to get unique_codes
                            studentsResult.rows.forEach(s => {
                                if (s.unique_code) {
                                    emitToStudent(s.unique_code, 'admit_card_published', {
                                        id: admitCard.id,
                                        exam_name: admitCard.exam_name,
                                        title,
                                        body
                                    });
                                }
                            });
                        }
                    }
                }
            }

            res.status(200).json({ message: 'Success', admitCard });
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