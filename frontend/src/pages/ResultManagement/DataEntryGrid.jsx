import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { API_ENDPOINTS } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import ReportCardView from './ReportCardView';
import './DataEntryGrid.css';

const DataEntryGrid = () => {
    const { id } = useParams();
    const navigate = useNavigate();
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
        fetchExamData();
    }, [id]);

    const fetchExamData = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:5000/api/exam/${id}/grid`, {
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
            const response = await axios.get(`http://localhost:5000/api/exam/students/search-class?class_name=${className}`, {
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

                return axios.post(`http://localhost:5000/api/exam/${id}/student/save`, {
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

    // --- Logic for Manual Stats Modal ---
    const handleSaveStats = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/exam/${id}/stats`, {
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

        const zip = format === 'zip' ? new JSZip() : null;
        const selectedData = students.filter(s => selectedIds.includes(s.student.id));

        try {
            for (let i = 0; i < selectedData.length; i++) {
                const item = selectedData[i];
                setCurrentProcessingTarget({
                    student: item.student,
                    exam: examData,
                    institute: examData, // Branding is now merged into examData by the server
                    result: { marks_data: item.marks_data, calculated_stats: item.calculated_stats, overall_remark: item.overall_remark }
                });

                // Wait to ensure React re-render and images are ready
                await new Promise(resolve => setTimeout(resolve, 1200));

                const element = document.getElementById('report-card-hidden-render');
                if (!element) continue;

                const canvas = await html2canvas(element, {
                    scale: 2.5, // 2.5 is a sweet spot for A4/JPG quality without crashing
                    useCORS: true,
                    allowTaint: false,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: 1000, // Match the target element width exactly
                    imageTimeout: 15000,
                });

                if (format === 'zip') {
                    // Capture as JPG for ZIP extraction (0.95 quality for clarity)
                    const imgDataJpg = canvas.toDataURL('image/jpeg', 0.95);
                    const base64Data = imgDataJpg.split(',')[1];
                    zip.file(`${item.student.roll_no}_${item.student.name.replace(/\s+/g, '_')}.jpg`, base64Data, { base64: true });
                } else {
                    // This block is for individual PDF if we were doing that
                }

                setProgress(Math.round(((i + 1) / selectedData.length) * 100));
            }

            if (format === 'zip') {
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `${examData.name}_ReportCards.zip`);
            } else {
                // Merged PDF Implementation
                const combinedPdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = combinedPdf.internal.pageSize.getWidth();
                const pdfHeight = combinedPdf.internal.pageSize.getHeight();

                for (let i = 0; i < selectedData.length; i++) {
                    const item = selectedData[i];
                    setCurrentProcessingTarget({
                        student: item.student,
                        exam: examData,
                        institute: examData,
                        result: { marks_data: item.marks_data, calculated_stats: item.calculated_stats, overall_remark: item.overall_remark }
                    });

                    await new Promise(r => setTimeout(r, 1200));
                    const el = document.getElementById('report-card-hidden-render');
                    const canvas = await html2canvas(el, {
                        scale: 2.5,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        windowWidth: 1000,
                        imageTimeout: 15000,
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = combinedPdf.getImageProperties(imgData);
                    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    if (i > 0) combinedPdf.addPage();
                    combinedPdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
                    setProgress(Math.round(((i + 1) / selectedData.length) * 100));
                }
                combinedPdf.save(`${examData.name}_Combined_Results.pdf`);
            }

            toast.success("Extraction Complete!");
        } catch (e) {
            console.error(e);
            toast.error("Error during generation");
        } finally {
            setProcessing(false);
            setCurrentProcessingTarget(null);
            setIsSelectionMode(false);
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
                    <button onClick={() => navigate('/dashboard/results')} className="btn-back-free">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
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
                                                onClick={() => navigate(`/dashboard/results/${id}/view/${item.student.id}`)}
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
                            <h3>Fill Marks: {examData.class_name}-{examData.section}</h3>
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
                                    {students.map((studentItem) => {
                                        const stdId = studentItem.student.id;
                                        return (
                                            <tr key={stdId}>
                                                <td>{studentItem.student.roll_no}</td>
                                                <td><b>{studentItem.student.name}</b></td>
                                                {gridMarks[stdId] && gridMarks[stdId].map((mark, idx) => (
                                                    <React.Fragment key={idx}>
                                                        <td className="input-cell" style={{ width: '80px' }}>
                                                            <input
                                                                type="text"
                                                                className="mark-input"
                                                                value={mark.theory || ''}
                                                                onChange={(e) => handleGridChange(stdId, idx, 'theory', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="input-cell" style={{ width: '60px' }}>
                                                            <input
                                                                type="text"
                                                                className="mark-input grade-cell"
                                                                value={mark.grade || ''}
                                                                onChange={(e) => handleGridChange(stdId, idx, 'grade', e.target.value)}
                                                                placeholder="A"
                                                                style={{ fontWeight: 'bold', color: '#1e40af' }}
                                                            />
                                                        </td>
                                                    </React.Fragment>
                                                ))}
                                                <td className="input-cell">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Excellent"
                                                        className="remark-input"
                                                        value={gridRemarks[stdId] || ''}
                                                        onChange={(e) => handleRemarkChange(stdId, e.target.value)}
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
                    <div className="modal-content" style={{ width: '500px' }}>
                        <div className="modal-header">
                            <h3>Set Highest Marks (Topper Data)</h3>
                            <button className="close-btn" onClick={() => setShowStatsModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            {/* Section Topper */}
                            <div className="form-group">
                                <label>Section Topper Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    list="section-students"
                                    placeholder="Select or type name..."
                                    value={manualStats.section_topper_name || ''}
                                    onChange={(e) => setManualStats({ ...manualStats, section_topper_name: e.target.value })}
                                />
                                <datalist id="section-students">
                                    {students.map(s => (
                                        <option key={s.student.id} value={s.student.name} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="form-group" style={{ marginTop: '10px' }}>
                                <label>Section Topper Total Marks</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g. 580"
                                    value={manualStats.section_topper_total || ''}
                                    onChange={(e) => setManualStats({ ...manualStats, section_topper_total: e.target.value })}
                                />
                            </div>

                            {/* Class Topper */}
                            <div className="form-group" style={{ marginTop: '15px' }}>
                                <label>Class Topper Name (All Sections)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    list="class-students"
                                    placeholder="Select or type name..."
                                    value={manualStats.class_topper_name || ''}
                                    onChange={(e) => setManualStats({ ...manualStats, class_topper_name: e.target.value })}
                                />
                                <datalist id="class-students">
                                    {classStudents.map(s => (
                                        <option key={s.id} value={`${s.name} (Sec ${s.section})`} />
                                    ))}
                                </datalist>
                            </div>

                            <div className="form-group" style={{ marginTop: '10px' }}>
                                <label>Class Topper Total Marks</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="e.g. 595"
                                    value={manualStats.class_topper_total || ''}
                                    onChange={(e) => setManualStats({ ...manualStats, class_topper_total: e.target.value })}
                                />
                            </div>

                            <hr style={{ margin: '20px 0', border: '.5px solid #eee' }} />
                            <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Highest Marks per Subject</p>
                            {subjects.map((sub, i) => (
                                <div key={i} className="form-group horizontal-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ marginBottom: 0 }}>{sub.name}</label>
                                    <input
                                        type="number"
                                        className="form-input small"
                                        style={{ width: '80px' }}
                                        value={manualStats[`highest_${sub.name}`] || ''}
                                        onChange={(e) => setManualStats({ ...manualStats, [`highest_${sub.name}`]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn-cancel" onClick={() => setShowStatsModal(false)}>Close</button>
                            <button className="btn-save" onClick={handleSaveStats}>Save Stats</button>
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
