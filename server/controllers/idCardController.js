import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import pool from '../config/db.js';
import { getBrowser } from '../utils/puppeteerManager.js';
import { getBase64Image } from '../utils/imageUtils.js';

// --- Global Concurrency Queue Logic ---
let activeJobs = 0;
const MAX_CONCURRENT_PDFS = 2; 
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

// --- PDF Generation Logic ---
const generateIDCardPDFLogic = async (studentIds, instituteId, res) => {
    let page = null;
    try {
        const pdfBuffer = await addToQueue(async () => {
            const instRes = await pool.query(
                `SELECT institute_name, address as institute_address, district, state, pincode, logo_url as institute_logo, affiliation, landmark 
                 FROM institutes WHERE id = $1`,
                [instituteId]
            );
            if (instRes.rows.length === 0) throw new Error('Institute not found');
            const inst = instRes.rows[0];

            const studentsDataRes = await pool.query(
                `SELECT * FROM students 
                 WHERE id = ANY($1) AND institute_id = $2
                 ORDER BY class, section, roll_no ASC`,
                [studentIds, instituteId]
            );
            const students = studentsDataRes.rows;

            const logoBase64 = await getBase64Image(inst.institute_logo?.startsWith('http') ? inst.institute_logo : (inst.institute_logo ? `${process.env.S3_BUCKET_URL}/${inst.institute_logo}` : null));

            const optimizedStudents = [];
            for (let i = 0; i < students.length; i += 5) {
                const chunk = students.slice(i, i + 5);
                const results = await Promise.all(chunk.map(async (s) => {
                    const rawPhoto = s.photo_url || s.profile_image;
                    const photoFullUrl = rawPhoto?.startsWith('http') ? rawPhoto : (rawPhoto ? `${process.env.S3_BUCKET_URL}/${rawPhoto}` : null);
                    const photoBase64 = photoFullUrl ? await getBase64Image(photoFullUrl) : null;
                    return { ...s, photoBase64 };
                }));
                optimizedStudents.push(...results);
            }

            const instAddress = [inst.institute_address, inst.landmark, inst.district, inst.state, inst.pincode].filter(Boolean).join(', ');

            let htmlContent = `<html><head><style>
                @page { size: A4; margin: 0; }
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; margin: 0; background: #f0f0f0; }
                .page-container { width: 210mm; height: 297mm; padding: 15mm; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; align-items: center; background: #fff; margin: 0 auto; }
                .id-card { width: 180mm; height: 110mm; margin-bottom: 20mm; background: #fff; border: 2px solid #000; border-radius: 15px; overflow: hidden; position: relative; display: flex; flex-direction: column; }
                .header-strip { background: linear-gradient(to right, #667eea, #764ba2); height: 20mm; display: flex; align-items: center; justify-content: center; padding: 0 20px; gap: 15px; }
                .inst-logo { width: 12mm; height: 12mm; border-radius: 50%; background: #fff; object-fit: contain; }
                .inst-name { color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
                .sub-header { background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 8px; text-align: center; font-size: 11px; font-weight: 900; color: #000; text-transform: uppercase; }
                .card-body { flex: 1; padding: 20px 35px; display: flex; gap: 30px; }
                .left-col { flex: 1; }
                .label { font-size: 10px; font-weight: 900; color: #555; text-transform: uppercase; margin-bottom: 4px; }
                .student-name-val { font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 15px; }
                .stats-row { display: flex; gap: 25px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; }
                .stat-val { font-size: 18px; font-weight: 900; color: #000; }
                .details-grid { display: flex; flex-wrap: wrap; gap: 15px; }
                .detail-item { width: 45%; }
                .detail-val { font-size: 14px; font-weight: 900; color: #000; }
                .right-col { width: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .photo-box { width: 135px; height: 160px; border: 2.5px solid #e2e8f0; border-radius: 10px; background: #f8fafc; overflow: hidden; }
                .photo-img { width: 100%; height: 100%; object-fit: cover; }
                .footer-strip { height: 12mm; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; letter-spacing: 3px; color: #000; text-transform: uppercase; }
            </style></head><body>`;

            for (let i = 0; i < optimizedStudents.length; i += 2) {
                htmlContent += `<div class="page-container">`;
                [optimizedStudents[i], optimizedStudents[i+1]].forEach(s => {
                    if (!s) return;
                    htmlContent += `
                    <div class="id-card">
                        <div class="header-strip">
                            ${logoBase64 ? `<img src="${logoBase64}" class="inst-logo" />` : ''}
                            <h1 class="inst-name">${inst.institute_name}</h1>
                        </div>
                        <div class="sub-header">${instAddress}</div>
                        <div class="card-body">
                            <div class="left-col">
                                <div class="label">Student Name</div>
                                <div class="student-name-val">${s.name}</div>
                                <div class="stats-row">
                                    <div style="flex:1"><div class="label">Class</div><div class="stat-val">${s.class}</div></div>
                                    <div style="flex:1"><div class="label">Section</div><div class="stat-val">${s.section}</div></div>
                                    <div style="flex:1"><div class="label">Roll No</div><div class="stat-val">${s.roll_no || 'TBD'}</div></div>
                                </div>
                                <div class="details-grid">
                                    <div class="detail-item"><div class="label">Father's Name</div><div class="detail-val">${s.father_name}</div></div>
                                    <div class="detail-item"><div class="label">Mother's Name</div><div class="detail-val">${s.mother_name || 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">Date of Birth</div><div class="detail-val">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">Contact No</div><div class="detail-val">${s.mobile}</div></div>
                                </div>
                                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                                    <div class="label">Residential Address</div>
                                    <div style="font-size: 11px; font-weight: 900; color: #000; line-height: 1.4;">${s.address || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="right-col">
                                <div class="photo-box">
                                    ${s.photoBase64 ? `<img src="${s.photoBase64}" class="photo-img" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#94a3b8;">NO PHOTO</div>'}
                                </div>
                            </div>
                        </div>
                        <div class="footer-strip">STUDENT IDENTITY CARD</div>
                    </div>`;
                });
                htmlContent += `</div>`;
            }
            htmlContent += `</body></html>`;

            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            return await page.pdf({ format: 'A4', printBackground: true, timeout: 120000, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        });

        res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdfBuffer.length, 'Content-Disposition': `attachment; filename="id_cards_bundle.pdf"` });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('ID Card PDF Error:', err.message);
        res.status(500).json({ message: 'Server error generating ID Cards' });
    } finally {
        if (page) await page.close();
    }
};

// --- JPG Generation Logic ---
const generateIDCardJPGLogic = async (studentIds, instituteId, res) => {
    let page = null;

    // If only one student, return raw JPG directly
    if (studentIds.length === 1) {
        try {
            const studentId = studentIds[0];
            const data = await addToQueue(async () => {
                const instRes = await pool.query(
                    `SELECT institute_name, address as institute_address, district, state, pincode, logo_url as institute_logo FROM institutes WHERE id = $1`,
                    [instituteId]
                );
                const inst = instRes.rows[0];
                const studentRes = await pool.query(
                    `SELECT * FROM students WHERE id = $1 AND institute_id = $2`,
                    [studentId, instituteId]
                );
                if (studentRes.rows.length === 0) throw new Error('Student not found');
                const s = studentRes.rows[0];
                
                const logoBase64 = await getBase64Image(inst.institute_logo?.startsWith('http') ? inst.institute_logo : (inst.institute_logo ? `${process.env.S3_BUCKET_URL}/${inst.institute_logo}` : null));
                const rawPhoto = s.photo_url || s.profile_image;
                const photoFullUrl = rawPhoto?.startsWith('http') ? rawPhoto : (rawPhoto ? `${process.env.S3_BUCKET_URL}/${rawPhoto}` : null);
                const photoBase64 = photoFullUrl ? await getBase64Image(photoFullUrl) : null;
                return { s, inst, logoBase64, photoBase64 };
            });

            const { s, inst, logoBase64, photoBase64 } = data;
            const instAddress = [inst.institute_address, inst.landmark, inst.district, inst.state, inst.pincode].filter(Boolean).join(', ');

            const htmlContent = `<html><head><style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; background: #fff; display: flex; justify-content: center; align-items: center; width: 180mm; height: 110mm; }
                .id-card { width: 180mm; height: 110mm; background: #fff; border: 2px solid #000; border-radius: 15px; overflow: hidden; display: flex; flex-direction: column; }
                .header-strip { background: linear-gradient(to right, #667eea, #764ba2); height: 20mm; display: flex; align-items: center; justify-content: center; padding: 0 20px; gap: 15px; }
                .inst-logo { width: 12mm; height: 12mm; border-radius: 50%; background: #fff; object-fit: contain; }
                .inst-name { color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
                .sub-header { background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 8px; text-align: center; font-size: 11px; font-weight: 900; color: #000; text-transform: uppercase; }
                .card-body { flex: 1; padding: 20px 35px; display: flex; gap: 30px; }
                .left-col { flex: 1; }
                .label { font-size: 10px; font-weight: 900; color: #555; text-transform: uppercase; margin-bottom: 4px; }
                .student-name-val { font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 15px; }
                .stats-row { display: flex; gap: 25px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; }
                .stat-val { font-size: 18px; font-weight: 900; color: #000; }
                .details-grid { display: flex; flex-wrap: wrap; gap: 15px; }
                .detail-item { width: 45%; }
                .detail-val { font-size: 14px; font-weight: 900; color: #000; }
                .right-col { width: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .photo-box { width: 135px; height: 160px; border: 2.5px solid #e2e8f0; border-radius: 10px; background: #f8fafc; overflow: hidden; }
                .photo-img { width: 100%; height: 100%; object-fit: cover; }
                .footer-strip { height: 12mm; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; letter-spacing: 3px; color: #000; text-transform: uppercase; }
            </style></head><body>
                <div class="id-card">
                    <div class="header-strip">
                        ${logoBase64 ? `<img src="${logoBase64}" class="inst-logo" />` : ''}
                        <h1 class="inst-name">${inst.institute_name}</h1>
                    </div>
                    <div class="sub-header">${instAddress}</div>
                    <div class="card-body">
                        <div class="left-col">
                            <div class="label">Student Name</div>
                            <div class="student-name-val">${s.name}</div>
                            <div class="stats-row">
                                <div style="flex:1"><div class="label">Class</div><div class="stat-val">${s.class}</div></div>
                                <div style="flex:1"><div class="label">Section</div><div class="stat-val">${s.section}</div></div>
                                <div style="flex:1"><div class="label">Roll No</div><div class="stat-val">${s.roll_no || 'TBD'}</div></div>
                            </div>
                            <div class="details-grid">
                                <div class="detail-item"><div class="label">Father's Name</div><div class="detail-val">${s.father_name}</div></div>
                                <div class="detail-item"><div class="label">Mother's Name</div><div class="detail-val">${s.mother_name || 'N/A'}</div></div>
                                <div class="detail-item"><div class="label">Date of Birth</div><div class="detail-val">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : 'N/A'}</div></div>
                                <div class="detail-item"><div class="label">Contact No</div><div class="detail-val">${s.mobile}</div></div>
                            </div>
                            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                                <div class="label">Residential Address</div>
                                <div style="font-size: 11px; font-weight: 900; color: #000; line-height: 1.4;">${s.address || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="right-col">
                            <div class="photo-box">
                                ${photoBase64 ? `<img src="${photoBase64}" class="photo-img" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#94a3b8;">NO PHOTO</div>'}
                            </div>
                        </div>
                    </div>
                    <div class="footer-strip">STUDENT IDENTITY CARD</div>
                </div>
            </body></html>`;

            const browser = await getBrowser();
            page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            const cardElement = await page.$('.id-card');
            const screenshot = await cardElement.screenshot({ type: 'jpeg', quality: 90 });
            
            res.set({ 'Content-Type': 'image/jpeg', 'Content-Length': screenshot.length, 'Content-Disposition': `attachment; filename="${s.name}_ID.jpg"` });
            return res.send(screenshot);
        } catch (err) {
            console.error('ID Card Single JPG Error:', err.message);
            if (!res.headersSent) res.status(500).json({ message: 'Server error generating JPG' });
        } finally {
            if (page) await page.close();
        }
        return;
    }

    const zip = archiver('zip', { zlib: { level: 9 } });
    res.attachment('id_cards_bundle.zip');
    zip.pipe(res);

    try {
        await addToQueue(async () => {
            const instRes = await pool.query(
                `SELECT institute_name, address as institute_address, district, state, pincode, logo_url as institute_logo FROM institutes WHERE id = $1`,
                [instituteId]
            );
            const inst = instRes.rows[0];

            const studentsDataRes = await pool.query(
                `SELECT * FROM students WHERE id = ANY($1) AND institute_id = $2 ORDER BY class, section, roll_no ASC`,
                [studentIds, instituteId]
            );
            const students = studentsDataRes.rows;

            const logoBase64 = await getBase64Image(inst.institute_logo?.startsWith('http') ? inst.institute_logo : (inst.institute_logo ? `${process.env.S3_BUCKET_URL}/${inst.institute_logo}` : null));

            const browser = await getBrowser();
            page = await browser.newPage();

            for (const s of students) {
                const rawPhoto = s.photo_url || s.profile_image;
                const photoFullUrl = rawPhoto?.startsWith('http') ? rawPhoto : (rawPhoto ? `${process.env.S3_BUCKET_URL}/${rawPhoto}` : null);
                const photoBase64 = photoFullUrl ? await getBase64Image(photoFullUrl) : null;
                const instAddress = [inst.institute_address, inst.landmark, inst.district, inst.state, inst.pincode].filter(Boolean).join(', ');

                const htmlContent = `<html><head><style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; background: #fff; display: flex; justify-content: center; align-items: center; width: 180mm; height: 110mm; }
                    .id-card { width: 180mm; height: 110mm; background: #fff; border: 2px solid #000; border-radius: 15px; overflow: hidden; display: flex; flex-direction: column; }
                    .header-strip { background: linear-gradient(to right, #667eea, #764ba2); height: 20mm; display: flex; align-items: center; justify-content: center; padding: 0 20px; gap: 15px; }
                    .inst-logo { width: 12mm; height: 12mm; border-radius: 50%; background: #fff; object-fit: contain; }
                    .inst-name { color: #fff; font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
                    .sub-header { background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 8px; text-align: center; font-size: 11px; font-weight: 900; color: #000; text-transform: uppercase; }
                    .card-body { flex: 1; padding: 20px 35px; display: flex; gap: 30px; }
                    .left-col { flex: 1; }
                    .label { font-size: 10px; font-weight: 900; color: #555; text-transform: uppercase; margin-bottom: 4px; }
                    .student-name-val { font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 15px; }
                    .stats-row { display: flex; gap: 25px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; }
                    .stat-val { font-size: 18px; font-weight: 900; color: #000; }
                    .details-grid { display: flex; flex-wrap: wrap; gap: 15px; }
                    .detail-item { width: 45%; }
                    .detail-val { font-size: 14px; font-weight: 900; color: #000; }
                    .right-col { width: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                    .photo-box { width: 135px; height: 160px; border: 2.5px solid #e2e8f0; border-radius: 10px; background: #f8fafc; overflow: hidden; }
                    .photo-img { width: 100%; height: 100%; object-fit: cover; }
                    .footer-strip { height: 12mm; border-top: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 900; letter-spacing: 3px; color: #000; text-transform: uppercase; }
                </style></head><body>
                    <div class="id-card">
                        <div class="header-strip">
                            ${logoBase64 ? `<img src="${logoBase64}" class="inst-logo" />` : ''}
                            <h1 class="inst-name">${inst.institute_name}</h1>
                        </div>
                        <div class="sub-header">${instAddress}</div>
                        <div class="card-body">
                            <div class="left-col">
                                <div class="label">Student Name</div>
                                <div class="student-name-val">${s.name}</div>
                                <div class="stats-row">
                                    <div style="flex:1"><div class="label">Class</div><div class="stat-val">${s.class}</div></div>
                                    <div style="flex:1"><div class="label">Section</div><div class="stat-val">${s.section}</div></div>
                                    <div style="flex:1"><div class="label">Roll No</div><div class="stat-val">${s.roll_no || 'TBD'}</div></div>
                                </div>
                                <div class="details-grid">
                                    <div class="detail-item"><div class="label">Father's Name</div><div class="detail-val">${s.father_name}</div></div>
                                    <div class="detail-item"><div class="label">Mother's Name</div><div class="detail-val">${s.mother_name || 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">Date of Birth</div><div class="detail-val">${s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">Contact No</div><div class="detail-val">${s.mobile}</div></div>
                                </div>
                                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                                    <div class="label">Residential Address</div>
                                    <div style="font-size: 11px; font-weight: 900; color: #000; line-height: 1.4;">${s.address || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="right-col">
                                <div class="photo-box">
                                    ${photoBase64 ? `<img src="${photoBase64}" class="photo-img" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#94a3b8;">NO PHOTO</div>'}
                                </div>
                            </div>
                        </div>
                        <div class="footer-strip">STUDENT IDENTITY CARD</div>
                    </div>
                </body></html>`;

                await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
                const cardElement = await page.$('.id-card');
                const screenshot = await cardElement.screenshot({ type: 'jpeg', quality: 90 });
                const filename = `${s.name.replace(/[^a-zA-Z0-9]/g, '_')}_ID_${s.roll_no || s.id}.jpg`;
                zip.append(screenshot, { name: filename });
            }
            zip.finalize();
        });
    } catch (err) {
        console.error('ID Card JPG Error:', err.message);
        if (!res.headersSent) res.status(500).json({ message: 'Server error generating JPGs' });
    } finally {
        if (page) await page.close();
    }
};

// --- Exports ---
export const generateBulkIDCardPDF = async (req, res) => {
    const { studentIds } = req.body;
    const instituteId = req.user?.institute_id || req.user?.id; // For staff, id is institute_id
    if (!studentIds?.length) return res.status(400).json({ message: 'No students selected' });
    
    // Security check: If student is requesting, they can only request their own ID
    if (req.user.type === 'student') {
        if (studentIds.length > 1 || parseInt(studentIds[0]) !== parseInt(req.user.id)) {
            return res.status(403).json({ message: 'Unauthorized. Students can only generate their own ID card.' });
        }
    }

    await generateIDCardPDFLogic(studentIds, instituteId, res);
};

export const generateBulkIDCardJPG = async (req, res) => {
    const { studentIds } = req.body;
    
    // Correctly resolve instituteId based on user type
    const instituteId = req.user.type === 'student' ? req.user.institute_id : (req.user?.institute_id || req.user?.id);
    
    if (!studentIds?.length) return res.status(400).json({ message: 'No students selected' });

    // Security check: If student is requesting, they can only request their own ID
    if (req.user.type === 'student') {
        if (studentIds.length > 1 || parseInt(studentIds[0]) !== parseInt(req.user.id)) {
            return res.status(403).json({ message: 'Unauthorized. Students can only generate their own ID card.' });
        }
    }

    await generateIDCardJPGLogic(studentIds, instituteId, res);
};