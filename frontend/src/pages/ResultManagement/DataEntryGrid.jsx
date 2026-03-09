import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { API_ENDPOINTS, BASE_URL } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import ReportCardView from './ReportCardView';
import './DataEntryGrid.css';

const DataEntryGrid = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isTeacher = location.pathname.startsWith('/teacher-dashboard');
    const basePath = isTeacher ? '/teacher-dashboard' : '/dashboard';

    const [loading, setLoading] = useState(true);
    const [examData, setExamData] = useState(null);
    const [students, setStudents] = useState([]);

    // UI State
    const [isComplete, setIsComplete] = useState(false);
    const [showFillModal, setShowFillModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit State
    const [gridMarks, setGridMarks] = useState({}); // { studentId: [ {subject: 'Math', theory, practical} ] }
    const [gridRemarks, setGridRemarks] = useState({}); // { studentId: 'Remark' }
    const [manualStats, setManualStats] = useState({}); // { subjectName: 99, ... }
    const [classStudents, setClassStudents] = useState([]); // Students from all sections of the class

    // Selection & Bulk Share State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentProcessingTarget, setCurrentProcessingTarget] = useState(null); // {student, exam, institute, result}

    useEffect(() => {
        if (showFillModal) {
            document.body.classList.add('hide-dashboard-ui');
        } else {
            document.body.classList.remove('hide-dashboard-ui');
        }
        return () => document.body.classList.remove('hide-dashboard-ui');
    }, [showFillModal]);

    useEffect(() => {
        fetchExamData();
    }, [id]);

    const fetchExamData = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${BASE_URL}/api/exam/${id}/grid`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setExamData(response.data.exam);

            // Only show students who actually have marks if incomplete? 
            // The requirement says: "rest should be filled automatically clicking on save the student list will appear on the page whose data is filled"
            // So we fetch ALL students, but in the main list we might filter. 
            // For the GRID, we need ALL students.
            setStudents(response.data.students);

            // Initialize Manual Stats
            setManualStats(response.data.exam.manual_stats || {});

            // Auto-check completion? (Optional, for now manual toggle)
            const allowComplete = response.data.students.some(s => s.marks_data && s.marks_data.length > 0);
            if (allowComplete) setIsComplete(true);

            // Fetch students from ALL sections for Class Topper suggestions
            if (response.data.exam.class_name) {
                fetchClassStudents(response.data.exam.class_name);
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to load exam data');
        } finally {
            setLoading(false);
        }
    };

    const fetchClassStudents = async (className) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${BASE_URL}/api/exam/students/search-class?class_name=${className}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setClassStudents(response.data);
        } catch (error) {
            console.error('Error fetching class students:', error);
        }
    };

    // --- Logic for Fill Marks Modal ---
    const handleOpenFillModal = () => {
        const initialGrid = {};
        const initialRemarks = {};
        students.forEach(s => {
            const studentMarks = s.marks_data || [];
            const completeMarks = examData.subjects_blueprint.map(sub => {
                const existing = studentMarks.find(m => m.subject === sub.name);
                return existing || { subject: sub.name, theory: '', practical: '', grade: '' };
            });
            initialGrid[s.student.id] = completeMarks;
            initialRemarks[s.student.id] = s.overall_remark || '';
        });
        setGridMarks(initialGrid);
        setGridRemarks(initialRemarks);
        setShowFillModal(true);
    };

    const handleGridChange = (studentId, subjectIndex, field, value) => {
        setGridMarks(prev => {
            const studentRow = [...prev[studentId]];
            let updatedMark = { ...studentRow[subjectIndex], [field]: value }; // Keep raw value (e.g. 80+18)

            // AUTO-GRADE logic: Evaluate for grading
            if (field === 'theory') {
                const subBlueprint = examData.subjects_blueprint.find(b => b.name === updatedMark.subject);
                if (subBlueprint && examData.grading_rules) {
                    const max = parseInt(subBlueprint.max_theory) || 100;
                    const obt = evaluateMark(value);
                    const percent = (obt / max) * 100;
                    const rule = examData.grading_rules.find(r => percent >= r.min && percent <= r.max);
                    if (rule) updatedMark.grade = rule.grade;
                }
            }

            studentRow[subjectIndex] = updatedMark;
            return { ...prev, [studentId]: studentRow };
        });
    };

    const evaluateMark = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.includes('+')) {
            return val.split('+').reduce((sum, p) => sum + (parseFloat(p.trim()) || 0), 0);
        }
        return parseFloat(val) || 0;
    };

    const handleRemarkChange = (studentId, value) => {
        setGridRemarks(prev => ({ ...prev, [studentId]: value }));
    };

    const handleSaveMarks = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            // We need to save for EACH student. For bulk speed, we might want a bulk endpoint, 
            // but loop is safer for existing single-student endpoint.
            // Let's optimize: only save changed or all? Saving all is safer for consistency.

            const promises = students.map(async (s) => {
                const marks = gridMarks[s.student.id];
                const remark = gridRemarks[s.student.id];

                // Calculate Stats (Total, %, Grade) locally before save
                let totalObtained = 0;
                let maxTotal = 0;

                marks.forEach(m => {
                    totalObtained += evaluateMark(m.theory) + evaluateMark(m.practical);
                    // Find max marks from blueprint
                    const blueprint = examData.subjects_blueprint.find(sub => sub.name === m.subject);
                    if (blueprint) {
                        maxTotal += (parseInt(blueprint.max_theory) || 0) + (parseInt(blueprint.max_practical) || 0);
                    }
                });

                let percentage = maxTotal > 0 ? ((totalObtained / maxTotal) * 100).toFixed(2) : 0;

                // Calculate Grade (Simplistic logic, can be enhanced)
                let grade = 'F';
                if (examData.grading_rules) {
                    const rule = examData.grading_rules.find(r => percentage >= r.min && percentage <= r.max);
                    if (rule) grade = rule.grade;
                }

                const calculated_stats = {
                    total: totalObtained,
                    percentage: percentage,
                    grade: grade
                };

                return axios.post(`${BASE_URL}/api/exam/${id}/student/save`, {
                    student_id: s.student.id,
                    marks_data: marks,
                    calculated_stats,
                    overall_remark: remark
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            });

            await Promise.all(promises);

            toast.success("All marks saved successfully");
            setShowFillModal(false);
            fetchExamData(); // Refresh list to update main view
            setIsComplete(true);

        } catch (error) {
            console.error(error);
            toast.error("Failed to save some marks");
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e, studentIndex, subIndex, field) => {
        const rowCount = students.length;
        const subCount = examData.subjects_blueprint.length;

        let nextStudent = studentIndex;
        let nextSub = subIndex;
        let nextField = field;

        if (e.key === 'Enter' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (field === 'theory') {
                nextField = 'grade';
            } else if (field === 'grade') {
                if (subIndex < subCount - 1) {
                    nextSub = subIndex + 1;
                    nextField = 'theory';
                } else {
                    // Move to next student first subject
                    if (studentIndex < rowCount - 1) {
                        nextStudent = studentIndex + 1;
                        nextSub = 0;
                        nextField = 'theory';
                    }
                }
            } else if (field === 'remark') {
                if (studentIndex < rowCount - 1) {
                    nextStudent = studentIndex + 1;
                    nextSub = 0;
                    nextField = 'theory';
                }
            }
        } else if (e.key === 'ArrowLeft') {
            if (field === 'grade') {
                nextField = 'theory';
            } else if (field === 'theory') {
                if (subIndex > 0) {
                    nextSub = subIndex - 1;
                    nextField = 'grade';
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (studentIndex < rowCount - 1) {
                nextStudent = studentIndex + 1;
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (studentIndex > 0) {
                nextStudent = studentIndex - 1;
            }
        }

        if (nextStudent !== studentIndex || nextSub !== subIndex || nextField !== field) {
            const id = `input-${nextStudent}-${nextSub}-${nextField}`;
            const nextInput = document.getElementById(id);
            if (nextInput) nextInput.focus();
        }
    };

    // --- Logic for Manual Stats Modal ---
    const handleSaveStats = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${BASE_URL}/api/exam/${id}/stats`, {
                manual_stats: manualStats
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Topper details updated");
            setShowStatsModal(false);
            fetchExamData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save stats");
        }
    };

    // --- Selection & Bulk Action Logic ---
    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedIds([]);
    };

    const handleSelectStudent = (studentId) => {
        setSelectedIds(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleSelectAll = (visibleStudents) => {
        if (selectedIds.length === visibleStudents.length && visibleStudents.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(visibleStudents.map(s => s.student.id));
        }
    };

    const runBulkExport = async (format) => {
        if (selectedIds.length === 0) return;

        setShowExportModal(false);
        setProcessing(true);
        setProgress(0);

        try {
            const token = localStorage.getItem('token');
            const profileRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const institute = profileRes.data.profile;

            // Helper for base64 conversion
            const toBase64 = async (url) => {
                if (!url) return null;
                try {
                    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
                    const response = await fetch(`${BASE_URL}/api/proxy-image?url=${encodeURIComponent(fullUrl)}`);
                    const blob = await response.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.warn("Base64 conversion failed for:", url);
                    return null;
                }
            };

            const logoB64 = await toBase64(institute.logo_url);
            const totalMax = examData.subjects_blueprint.reduce((sum, sub) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);
            const manualStats = examData.manual_stats || {};

            const getReportHTML = async (studentItem) => {
                const s = studentItem.student;
                const r = studentItem.calculated_stats || {};
                const m = studentItem.marks_data || [];
                const photoB64 = await toBase64(s.profile_image || s.photo_url);

                return `
                    <div style="width: 210mm; min-height: 290mm; padding: 15px; padding-top: 25px; box-sizing: border-box; background: #fff; page-break-after: always; display: flex; flex-direction: column; position: relative; border: 2.5px solid #000; border-radius: 2px; overflow: hidden; margin: 0 auto; font-family: 'Helvetica', Arial, sans-serif;">
                        <div style="position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border: 0.8px solid #333; pointer-events: none; z-index: 0;"></div>
                        
                        <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; z-index: 10; text-align: center;">
                            <div style="display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 12px; margin-bottom: 5px;">
                                ${logoB64 ? `<img src="${logoB64}" style="width: 60px; height: 60px; object-fit: contain;" />` : ''}
                                <h1 style="font-size: 26px; font-weight: 900; color: #1e1b4b; text-transform: uppercase; line-height: 28px; margin: 0;">${institute.institute_name}</h1>
                            </div>
                            ${institute.affiliation ? `<p style="font-size: 14px; color: #4f46e5; font-weight: 700; margin-top: -8px; margin-bottom: 2px;">${institute.affiliation}</p>` : ''}
                            <p style="font-size: 10.5px; color: #444; text-align: center; font-weight: 700; margin-top: 0;">${institute.address || ''} ${institute.landmark || ''} ${institute.district || ''} ${institute.state || ''} ${institute.pincode || ''}</p>
                            
                            <div style="margin-top: 15px; padding: 6px 35px; background: #1e1b4b; border-radius: 4px; transform: skewX(-10deg);">
                                <h2 style="font-size: 15px; font-weight: 900; color: #fff; text-align: center; text-transform: uppercase; transform: skewX(10deg); margin: 0;">${examData.name}</h2>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: row; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1.5px solid #e2e8f0;">
                            <div style="flex: 1; margin-right: 10px;">
                                <div style="display: flex; flex-direction: row; border-bottom: 1px solid #cbd5e1; padding: 5px 0;"><div style="width: 90px; font-size: 9px; font-weight: 800; color: #64748b;">STUDENT NAME</div><div style="flex: 1; font-size: 12px; font-weight: 900; color: #0f172a;">${s.name}</div></div>
                                <div style="display: flex; flex-direction: row; border-bottom: 1px solid #cbd5e1; padding: 5px 0;"><div style="width: 90px; font-size: 9px; font-weight: 800; color: #64748b;">CLASS & SECTION</div><div style="flex: 1; font-size: 12px; font-weight: 900; color: #0f172a;">${s.class} - ${s.section}</div></div>
                                <div style="display: flex; flex-direction: row; border-bottom: 1px solid #cbd5e1; padding: 5px 0;"><div style="width: 90px; font-size: 9px; font-weight: 800; color: #64748b;">ROLL NUMBER</div><div style="flex: 1; font-size: 12px; font-weight: 900; color: #0f172a;">${s.roll_no}</div></div>
                                <div style="display: flex; flex-direction: row; border-bottom: 1px solid #cbd5e1; padding: 5px 0;"><div style="width: 90px; font-size: 9px; font-weight: 800; color: #64748b;">FATHER'S NAME</div><div style="flex: 1; font-size: 12px; font-weight: 900; color: #0f172a;">${s.father_name || '-'}</div></div>
                                <div style="display: flex; flex-direction: row; border-bottom: 1px solid #cbd5e1; padding: 5px 0;"><div style="width: 90px; font-size: 9px; font-weight: 800; color: #64748b;">DATE OF BIRTH</div><div style="flex: 1; font-size: 12px; font-weight: 900; color: #0f172a;">${s.dob ? new Date(s.dob).toLocaleDateString('en-GB') : '-'}</div></div>
                            </div>
                            <div style="width: 85px; height: 105px; border: 3px solid #fff; background: #fff; box-shadow: 0 4px 5px rgba(0,0,0,0.2); display: flex; justify-content: center; align-items: center; overflow: hidden; border-radius: 4px; flex-shrink: 0;">
                                ${photoB64 ? `<img src="${photoB64}" style="width: 100%; height: 100%; object-fit: cover;" />` : ''}
                            </div>
                        </div>

                        <div style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; border: 2px solid #1e1b4b;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: #1e1b4b;">
                                    <tr>
                                        <th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: left; padding-left: 15px; width: 35%;">SUBJECT</th>
                                        <th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: center;">MAX</th>
                                        <th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: center;">PASS</th>
                                        <th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: center;">OBT</th>
                                        ${examData.show_highest_marks ? '<th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: center;">HIGH</th>' : ''}
                                        <th style="color: #fff; padding: 10px 6px; font-size: 10px; font-weight: 900; text-align: center;">GRADE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${examData.subjects_blueprint.map((sub, idx) => {
                                        const resMark = m.find((mk) => mk.subject === sub.name) || {};
                                        const high = manualStats[`highest_${sub.name}`] || '-';
                                        return `
                                            <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                                                <td style="padding: 10px 6px; font-size: 10px; font-weight: 900; color: #1e293b; text-align: left; padding-left: 15px;">${sub.name}</td>
                                                <td style="padding: 10px 6px; font-size: 10px; font-weight: 800; color: #000; text-align: center;">${(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</td>
                                                <td style="padding: 10px 6px; font-size: 10px; font-weight: 800; color: #000; text-align: center;">${sub.passing_marks || '-'}</td>
                                                <td style="padding: 10px 6px; font-size: 12px; font-weight: 900; color: #4f46e5; text-align: center;">${resMark.theory || '-'}</td>
                                                ${examData.show_highest_marks ? `<td style="padding: 10px 6px; font-size: 10px; font-weight: 800; color: #6366f1; text-align: center;">${high}</td>` : ''}
                                                <td style="padding: 10px 6px; font-size: 10px; font-weight: 900; color: #000; text-align: center;">${resMark.grade || '-'}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="display: flex; flex-direction: row; justify-content: space-between; background: #1e1b4b; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="display: flex; flex-direction: column; align-items: center;"><div style="font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 2px;">GRAND TOTAL</div><div style="font-size: 18px; font-weight: 900; color: #fff;">${r.total || 0} / ${totalMax}</div></div>
                            <div style="display: flex; flex-direction: column; align-items: center;"><div style="font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 2px;">PERCENTAGE</div><div style="font-size: 18px; font-weight: 900; color: #fff;">${r.percentage || 0}%</div></div>
                            <div style="display: flex; flex-direction: column; align-items: center;"><div style="font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 2px;">FINAL GRADE</div><div style="font-size: 18px; font-weight: 900; color: #fbbf24;">${r.grade || '-'}</div></div>
                        </div>

                        ${(manualStats.section_topper_name || manualStats.class_topper_name) ? `
                            <div style="display: flex; flex-direction: row; gap: 10px; margin-top: 5px; margin-bottom: 15px;">
                                ${manualStats.section_topper_name ? `
                                    <div style="flex: 1; display: flex; flex-direction: row; align-items: center; background: #f5f3ff; border: 1.5px solid #4f46e5; padding: 8px 10px; border-radius: 12px; gap: 10px;">
                                        <span style="font-size: 18px;">🏆</span>
                                        <div style="flex: 1;">
                                            <div style="font-size: 10px; font-weight: 900; color: #1e1b4b;">Section Topper: ${manualStats.section_topper_name}</div>
                                            <div style="font-size: 8px; font-weight: 800; color: #4338ca;">Score: ${manualStats.section_topper_total} / ${totalMax}</div>
                                        </div>
                                    </div>
                                ` : ''}
                                ${manualStats.class_topper_name ? `
                                    <div style="flex: 1; display: flex; flex-direction: row; align-items: center; background: #f5f3ff; border: 1.5px solid #4f46e5; padding: 8px 10px; border-radius: 12px; gap: 10px;">
                                        <span style="font-size: 18px;">🎖️</span>
                                        <div style="flex: 1;">
                                            <div style="font-size: 10px; font-weight: 900; color: #1e1b4b;">Class Topper: ${manualStats.class_topper_name}</div>
                                            <div style="font-size: 8px; font-weight: 800; color: #4338ca;">Score: ${manualStats.class_topper_total} / ${totalMax}</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <div style="padding: 12px; background: #fffbeb; border-radius: 10px; border-left: 5px solid #f59e0b; margin-bottom: 20px;">
                            <div style="font-size: 10px; font-weight: 900; color: #92400e; margin-bottom: 3px;">OFFICIAL REMARKS</div>
                            <div style="font-size: 11px; font-style: italic; color: #451a03; font-weight: 600;">"${studentItem.overall_remark || 'Satisfactory performance. Aim for higher goals in the next academic term.'}"</div>
                        </div>

                        <div style="display: flex; flex-direction: row; justify-content: space-between; margin-top: auto; padding: 0 5px 25px 5px;">
                            <div style="border-top: 2px solid #1e1b4b; width: 85px; display: flex; flex-direction: column; align-items: center; padding-top: 8px;"><span style="font-size: 9px; font-weight: 900; color: #1e1b4b;">TEACHER</span></div>
                            <div style="border-top: 2px solid #1e1b4b; width: 85px; display: flex; flex-direction: column; align-items: center; padding-top: 8px;"><span style="font-size: 9px; font-weight: 900; color: #1e1b4b;">PRINCIPAL</span></div>
                            <div style="border-top: 2px solid #1e1b4b; width: 85px; display: flex; flex-direction: column; align-items: center; padding-top: 8px;"><span style="font-size: 9px; font-weight: 900; color: #1e1b4b;">PARENT</span></div>
                        </div>
                    </div>
                `;
            };

            const selectedData = students.filter(s => selectedIds.includes(s.student.id));

            if (format === 'zip') {
                const zip = new JSZip();
                for (let i = 0; i < selectedData.length; i++) {
                    const item = selectedData[i];
                    setProgress(Math.round(((i + 1) / selectedData.length) * 100));

                    const html = await getReportHTML(item);
                    const doc = new jsPDF('p', 'mm', 'a4');
                    
                    const tempDiv = document.createElement('div');
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px';
                    tempDiv.innerHTML = html;
                    document.body.appendChild(tempDiv);

                    const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    doc.addImage(imgData, 'JPEG', 0, 0, 210, 290);
                    
                    const pdfBlob = doc.output('blob');
                    zip.file(`${item.student.roll_no}_${item.student.name.replace(/\s+/g, '_')}.pdf`, pdfBlob);
                    document.body.removeChild(tempDiv);
                }
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `${examData.name}_Reports.zip`);
            } else {
                const combinedPdf = new jsPDF('p', 'mm', 'a4');
                for (let i = 0; i < selectedData.length; i++) {
                    const item = selectedData[i];
                    setProgress(Math.round(((i + 1) / selectedData.length) * 100));

                    const html = await getReportHTML(item);
                    const tempDiv = document.createElement('div');
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px';
                    tempDiv.innerHTML = html;
                    document.body.appendChild(tempDiv);

                    const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    
                    if (i > 0) combinedPdf.addPage();
                    combinedPdf.addImage(imgData, 'JPEG', 0, 0, 210, 290);
                    document.body.removeChild(tempDiv);
                }
                combinedPdf.save(`${examData.name}_Combined_Results.pdf`);
            }

            toast.success("Extraction Complete!");
        } catch (e) {
            console.error(e);
            toast.error("Error during generation");
        } finally {
            setProcessing(false);
            setIsSelectionMode(false);
            setSelectedIds([]);
        }
    };

    // --- Render ---

    if (loading) return <div className="loading-spinner">Loading Student List...</div>;
    if (!examData) return <div className="error-state">Exam not found</div>;

    const subjects = examData.subjects_blueprint || [];

    // Filter students for Main View: Only show those who have some data (or all if we want grid logic)
    // Requirement: "student list should be only those student ... whose data is filled"
    const visibleStudents = students.filter(s => s.marks_data && s.marks_data.length > 0 && s.marks_data.some(m => m.theory || m.practical));

    const { theme } = useTheme();

    return (
        <div className={`data-entry-container theme-${theme}`}>
            {/* Free-Flow Header Toolbar */}
            <div className="entry-header-professional">
                <div className="header-left">
                    <button onClick={() => navigate(`${basePath}/results`)} className="btn-back-free" title="Back to Results">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                    </button>
                    <div className="title-group-free">
                        <h2 className="exam-title-free">{examData.name}</h2>
                        <div className="class-badge-free">
                            Class {examData.class_name} • Section {examData.section}
                        </div>
                    </div>
                </div>

                <div className="action-toolbar-free">
                    {/* Share: Toggle Selection Mode */}
                    {isComplete && (
                        <>
                            {isSelectionMode && selectedIds.length > 0 && (
                                <button className="btn-action-premium btn-download-bulk" onClick={() => setShowExportModal(true)}>
                                    🚀 Download ({selectedIds.length})
                                </button>
                            )}
                            <button className={`btn-action-premium ${isSelectionMode ? 'btn-cancel-selection' : 'btn-share-trigger'}`} onClick={toggleSelectionMode}>
                                {isSelectionMode ? 'Cancel' : '📤 Share Results'}
                            </button>
                        </>
                    )}

                    {!isSelectionMode && (
                        <>
                            <button className="btn-action-premium btn-fill-marks" onClick={handleOpenFillModal}>
                                ✏️ Fill Marks
                            </button>

                            {examData.show_highest_marks && (
                                <button className="btn-action-premium btn-set-highest" onClick={() => setShowStatsModal(true)}>
                                    🏆 Set Highest
                                </button>
                            )}

                            <button className={`btn-action-premium btn-done-status ${isComplete ? 'is-completed' : ''}`} onClick={() => setIsComplete(true)}>
                                {isComplete ? '✅ Marks Ready' : 'Mark as Done'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Selection HUD */}
            {isSelectionMode && selectedIds.length > 0 && (
                <div className="selection-overlay">
                    <span><b>{selectedIds.length}</b> Students Selected</span>
                    <button className="btn-final-share" onClick={() => setShowExportModal(true)}>
                        Share / Download 🚀
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="content-area">
                {visibleStudents.length === 0 ? (
                    <div className="empty-state-start">
                        <div className="illustration">📝</div>
                        <h3>No Result Data Yet</h3>
                        <p>Click "Fill Marks" to enter marks for {students.length} students in this class.</p>
                    </div>
                ) : (
                    <div className="student-results-list">
                        <div className="list-header">
                            {isSelectionMode && (
                                <span className="col-selection">
                                    <input
                                        type="checkbox"
                                        className="custom-checkbox"
                                        checked={selectedIds.length === visibleStudents.length && visibleStudents.length > 0}
                                        onChange={() => handleSelectAll(visibleStudents)}
                                    />
                                </span>
                            )}
                            <span className="col-roll">Roll No</span>
                            <span className="col-name">Student Name</span>
                            {subjects.map((sub, i) => (
                                <span key={i} className="col-sub">{sub.name}</span>
                            ))}
                            <span className="col-total">Total</span>
                            <span className="col-action">Action</span>
                        </div>

                        <div className="list-body">
                            {visibleStudents.map((item) => {
                                const marks = item.marks_data || [];
                                const total = marks.reduce((sum, m) => sum + evaluateMark(m.theory) + evaluateMark(m.practical), 0);

                                return (
                                    <div
                                        key={item.student.id}
                                        className={`student-row ${selectedIds.includes(item.student.id) ? 'selected' : ''}`}
                                        onClick={() => isSelectionMode && handleSelectStudent(item.student.id)}
                                        style={{ cursor: isSelectionMode ? 'pointer' : 'default' }}
                                    >
                                        {isSelectionMode && (
                                            <span className="col-selection">
                                                <input
                                                    type="checkbox"
                                                    className="custom-checkbox"
                                                    checked={selectedIds.includes(item.student.id)}
                                                    onChange={(e) => { e.stopPropagation(); handleSelectStudent(item.student.id); }}
                                                />
                                            </span>
                                        )}
                                        <span className="col-roll">{item.student.roll_no}</span>
                                        <span className="col-name">
                                            {item.student.profile_image ? (
                                                <img
                                                    src={item.student.profile_image}
                                                    alt={item.student.name}
                                                    className="student-list-img"
                                                />
                                            ) : (
                                                <div className="avatar">{item.student.name.charAt(0)}</div>
                                            )}
                                            {item.student.name}
                                        </span>

                                        {subjects.map((sub, i) => {
                                            const subMark = marks.find(m => m.subject === sub.name);
                                            const score = subMark ? (parseInt(subMark.theory) || 0) : '-';
                                            return <span key={i} className="col-sub">{score}</span>;
                                        })}

                                        <span className="col-total">{total}</span>

                                        <span className="col-action">
                                            <button
                                                className="btn-view-card"
                                                onClick={() => navigate(`${basePath}/results/${id}/view/${item.student.id}`)}
                                            >
                                                View Card
                                            </button>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* --- FILL MARKS MODAL (Quick Excel-like Grid) --- */}
            {showFillModal && (
                <div className="modal-fullscreen-overlay">
                    <div className="modal-fullscreen-content">
                        <div className="modal-fs-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button className="btn-back-fs" onClick={() => setShowFillModal(false)} title="Back to List">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h3>Fill Marks: {examData.class_name}-{examData.section}</h3>
                            </div>
                            <div className="fs-actions">
                                <button className="btn-cancel" onClick={() => setShowFillModal(false)}>Cancel</button>
                                <button className="btn-save" onClick={handleSaveMarks} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save All Changes'}
                                </button>
                            </div>
                        </div>

                        <div className="grid-container-scroll">
                            <table className="excel-grid">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '50px' }} rowSpan={2}>Roll</th>
                                        <th style={{ minWidth: '200px' }} rowSpan={2}>Student Name</th>
                                        {subjects.map((sub, i) => (
                                            <th key={i} colSpan={2} className="subject-header">
                                                {sub.name} <br />
                                                <span className="sub-tag">Max: {sub.max_theory}</span>
                                            </th>
                                        ))}
                                        <th style={{ minWidth: '150px' }} rowSpan={2}>Remark</th>
                                    </tr>
                                    <tr>
                                        {subjects.map((_, i) => (
                                            <React.Fragment key={i}>
                                                <th style={{ width: '80px', fontSize: '11px', background: '#f1f5f9' }}>Marks</th>
                                                <th style={{ width: '60px', fontSize: '11px', background: '#f1f5f9' }}>Grade</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((studentItem, sIdx) => {
                                        const stdId = studentItem.student.id;
                                        return (
                                            <tr key={stdId}>
                                                <td>{studentItem.student.roll_no}</td>
                                                <td><b>{studentItem.student.name}</b></td>
                                                {gridMarks[stdId] && gridMarks[stdId].map((mark, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <td className="input-cell" style={{ width: '80px' }}>
                                                            <input
                                                                id={`input-${sIdx}-${idx}-theory`}
                                                                type="text"
                                                                className="mark-input"
                                                                value={mark.theory || ''}
                                                                onChange={(e) => handleGridChange(stdId, idx, 'theory', e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, sIdx, idx, 'theory')}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="input-cell" style={{ width: '60px' }}>
                                                            <input
                                                                id={`input-${sIdx}-${idx}-grade`}
                                                                type="text"
                                                                className="mark-input grade-cell"
                                                                value={mark.grade || ''}
                                                                onChange={(e) => handleGridChange(stdId, idx, 'grade', e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, sIdx, idx, 'grade')}
                                                                placeholder="A"
                                                                style={{ fontWeight: 'bold', color: '#1e40af' }}
                                                            />
                                                        </td>
                                                    </React.Fragment>
                                                ))}
                                                <td className="input-cell">
                                                    <input
                                                        id={`input-${sIdx}-0-remark`}
                                                        type="text"
                                                        placeholder="e.g. Excellent"
                                                        className="remark-input"
                                                        value={gridRemarks[stdId] || ''}
                                                        onChange={(e) => handleRemarkChange(stdId, e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, sIdx, 0, 'remark')}
                                                        style={{ width: '100%', border: 'none', padding: '8px', outline: 'none', fontSize: '13px' }}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- HIGHEST/STATS MODAL --- */}
            {showStatsModal && (
                <div className="modal-overlay">
                    <div className="stats-modal-content">
                        <div className="modal-header-professional">
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Topper Configuration</h3>
                            <button className="close-btn" onClick={() => setShowStatsModal(false)}>×</button>
                        </div>
                        <div className="modal-body-scroll">
                            {/* Class Topper (1 Row) */}
                            <div className="topper-row-entry">
                                <div>
                                    <div className="section-label-premium">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>
                                        CLASS TOPPER (ALL SECTIONS)
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input"
                                        list="class-students"
                                        placeholder="Search class topper name..."
                                        value={manualStats.class_topper_name || ''}
                                        onChange={(e) => setManualStats({ ...manualStats, class_topper_name: e.target.value })}
                                    />
                                    <datalist id="class-students">
                                        {classStudents.map(s => (
                                            <option key={s.id} value={`${s.name} (Sec ${s.section})`} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>GRAND TOTAL</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Max: 600"
                                        value={manualStats.class_topper_total || ''}
                                        onChange={(e) => setManualStats({ ...manualStats, class_topper_total: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Section Topper (1 Row) */}
                            <div className="topper-row-entry">
                                <div>
                                    <div className="section-label-premium">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        SECTION TOPPER
                                    </div>
                                    <input
                                        type="text"
                                        className="form-input"
                                        list="section-students"
                                        placeholder="Search section student..."
                                        value={manualStats.section_topper_name || ''}
                                        onChange={(e) => setManualStats({ ...manualStats, section_topper_name: e.target.value })}
                                    />
                                    <datalist id="section-students">
                                        {students.map(s => (
                                            <option key={s.student.id} value={s.student.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>TOTAL MARKS</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="Obtained"
                                        value={manualStats.section_topper_total || ''}
                                        onChange={(e) => setManualStats({ ...manualStats, section_topper_total: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Subject Wise Grid */}
                            <div style={{ marginTop: '25px' }}>
                                <div className="section-label-premium" style={{ marginBottom: '15px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    SUBJECT-WISE HIGHEST MARKS
                                </div>
                                <div className="subject-marks-grid">
                                    {subjects.map((sub, i) => (
                                        <div key={i} className="sub-input-box">
                                            <label>{sub.name}</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="Highest"
                                                value={manualStats[`highest_${sub.name}`] || ''}
                                                onChange={(e) => setManualStats({ ...manualStats, [`highest_${sub.name}`]: e.target.value })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer-professional">
                            <button className="btn-cancel" onClick={() => setShowStatsModal(false)}>Cancel</button>
                            <button className="btn-save" onClick={handleSaveStats}>Update Marks Strategy</button>
                        </div>
                    </div>
                </div>
            )}


            {/* --- EXPORT SELECTION MODAL --- */}
            {showExportModal && (
                <div className="modal-overlay">
                    <div className="modal-content luxury-modal" style={{ width: '400px', textAlign: 'center', padding: '30px' }}>
                        <h3 style={{ color: '#1e3a8a', fontSize: '1.4rem' }}>Export Report Cards</h3>
                        <p style={{ color: '#64748b', margin: '15px 0' }}>Choose your preferred format for <b>{selectedIds.length}</b> selected students.</p>

                        <div style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
                            <button className="btn-tool" style={{ justifyContent: 'center', background: '#f1f5f9', border: '1.5px solid #cbd5e1' }} onClick={() => runBulkExport('pdf')}>
                                <span style={{ fontSize: '20px' }}>📄</span> Download Single PDF (Merged)
                            </button>
                            <button className="btn-tool" style={{ justifyContent: 'center', background: '#1e3a8a', color: 'white' }} onClick={() => runBulkExport('zip')}>
                                <span style={{ fontSize: '20px' }}>🖼️</span> Download ZIP (Individual JPGs)
                            </button>
                        </div>

                        <button
                            className="btn-cancel"
                            style={{ marginTop: '20px', border: 'none', background: 'none', color: '#64748b', textDecoration: 'underline' }}
                            onClick={() => setShowExportModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* --- PROCESSING OVERLAY --- */}
            {processing && (
                <div className="processing-overlay">
                    <div className="premium-loader"></div>
                    <div className="processing-text">Crafting Masterpieces...</div>
                    <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p style={{ marginTop: '10px', color: '#64748b' }}>{progress}% Processed</p>
                </div>
            )}

            {/* --- HIDDEN RENDERING ZONE (Used for PDF Capture) --- */}
            {/* --- HIDDEN RENDERING ZONE (Used for PDF Capture) --- */}
            <div style={{
                position: 'fixed',
                top: '0',
                left: '-5000px', // Far off-screen
                width: '1000px',
                height: 'auto',
                pointerEvents: 'none',
                zIndex: '-5000',
                overflow: 'hidden',
                background: 'white'
            }}>
                <div id="report-card-hidden-render" style={{ background: 'white', padding: '0', width: '1000px', margin: '0' }}>
                    {currentProcessingTarget && (
                        <ReportCardView
                            student={currentProcessingTarget.student}
                            exam={currentProcessingTarget.exam}
                            institute={currentProcessingTarget.institute}
                            result={currentProcessingTarget.result}
                            isExporting={true}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataEntryGrid;
