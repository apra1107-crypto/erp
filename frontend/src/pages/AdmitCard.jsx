import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { API_ENDPOINTS, BASE_URL } from '../config';
import './AdmitCard.css';

const AdmitCard = () => {
    const rawData = localStorage.getItem('userData');
    const userData = rawData ? JSON.parse(rawData) : null;
    const token = localStorage.getItem('token');

    const [admitCardEvents, setAdmitCardEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('list'); // list, create, event-details, individual
    const [isPrinting, setIsPrinting] = useState(false);

    // Form States
    const [examName, setExamName] = useState('');
    const [availableClassSections, setAvailableClassSections] = useState([]);
    const [selectedClasses, setSelectedClasses] = useState([]); // [{class, section}]
    const [schedule, setSchedule] = useState([{ date: '', day: '', subject: '', time: '' }]);
    const [creationStep, setCreationStep] = useState(1);

    // View States
    const [currentEvent, setCurrentEvent] = useState(null);
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [activeClassTab, setActiveClassTab] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [instProfile, setInstProfile] = useState(null);
    const [selectionMap, setSelectionMap] = useState({}); // {studentId: boolean}
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [showExportOptions, setShowExportOptions] = useState(false);
    const bulkContainerRef = useRef(null);

    useEffect(() => {
        fetchAdmitCardEvents();
        fetchClassSections();
        fetchInstituteProfile();
    }, []);

    const fetchInstituteProfile = async () => {
        try {
            const userType = localStorage.getItem('userType');
            let endpoint = '';
            if (userType === 'principal') {
                endpoint = `${API_ENDPOINTS.PRINCIPAL}/profile`;
            } else if (userType === 'teacher') {
                endpoint = `${API_ENDPOINTS.AUTH.TEACHER}/profile`;
            }

            if (endpoint) {
                const response = await axios.get(endpoint, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Normalize response structure
                const data = response.data.profile || response.data.teacher || response.data;
                setInstProfile(data);
            }
        } catch (error) {
            console.error('Error fetching institute profile:', error);
        }
    };

    const fetchAdmitCardEvents = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdmitCardEvents(response.data || []);
        } catch (error) {
            console.error('Error fetching admit cards:', error);
            toast.error('Failed to load admit card events');
        } finally {
            setLoading(false);
        }
    };

    const fetchClassSections = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allStudents = response.data.students || [];
            const unique = [];
            const map = new Map();
            for (const s of allStudents) {
                const key = `${s.class}-${s.section}`;
                if (!map.has(key)) {
                    map.set(key, true);
                    unique.push({ class: s.class, section: s.section });
                }
            }
            setAvailableClassSections(unique.sort((a, b) => String(a.class).localeCompare(String(b.class), undefined, { numeric: true }) || a.section.localeCompare(b.section)));
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const handleClassToggle = (cs) => {
        const index = selectedClasses.findIndex(item => item.class === cs.class && item.section === cs.section);
        if (index > -1) {
            setSelectedClasses(selectedClasses.filter((_, i) => i !== index));
        } else {
            setSelectedClasses([...selectedClasses, cs]);
        }
    };

    const addScheduleRow = () => {
        const lastRow = schedule[schedule.length - 1];
        setSchedule([...schedule, {
            date: '',
            day: '',
            subject: '',
            time: lastRow ? lastRow.time : ''
        }]);
    };

    const removeScheduleRow = (index) => {
        setSchedule(schedule.filter((_, i) => i !== index));
    };

    const updateScheduleRow = (index, field, value) => {
        const newSchedule = [...schedule];
        newSchedule[index][field] = value;

        if (field === 'date' && value) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dateObj = new Date(value);
            if (!isNaN(dateObj.getTime())) {
                newSchedule[index].day = days[dateObj.getDay()];
            }
        }
        setSchedule(newSchedule);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        // Check if it's already in DD-MM-YYYY
        if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const toggleStudentSelection = (studentId, e) => {
        e.stopPropagation();
        setSelectionMap(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    const toggleSelectAll = () => {
        const allSelected = filteredStudents.every(s => selectionMap[s.id]);
        const newMap = { ...selectionMap };
        filteredStudents.forEach(s => {
            newMap[s.id] = !allSelected;
        });
        setSelectionMap(newMap);
    };

    const getSelectedCount = () => {
        return Object.values(selectionMap).filter(Boolean).length;
    };

    const toBase64 = (url) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';

            // Route all images through backend proxy to bypass CORS/S3 security
            const absoluteUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
            const finalUrl = `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(absoluteUrl)}`;

            img.src = finalUrl;
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    console.warn("Base64 error:", absoluteUrl, e);
                    resolve(null);
                }
            };
            img.onerror = () => {
                console.warn("Proxy load failed:", finalUrl);
                resolve(null);
            };
        });
    };

    const handleBulkShare = async () => {
        const selectedIds = Object.keys(selectionMap).filter(id => selectionMap[id]);
        if (selectedIds.length === 0) return toast.warning('Select students first');

        const userType = localStorage.getItem('userType');
        if (userType === 'teacher' || userType === 'principal') {
            setShowExportOptions(true);
        } else {
            // Default to PDF for others
            generatePDF();
        }
    };

    const generatePDF = async () => {
        const selectedData = filteredStudents.filter(s => selectionMap[s.id]);
        setShowExportOptions(false);

        try {
            setIsGeneratingPDF(true);
            setProgress({ current: 0, total: selectedData.length });

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Fetch Institute Logo Base64 once
            const instLogoB64 = await toBase64(instProfile.logo_url || instProfile.institute_logo || '');

            for (let i = 0; i < selectedData.length; i++) {
                const student = selectedData[i];
                setProgress(prev => ({ ...prev, current: i + 1 }));

                const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

                const element = document.createElement('div');
                element.style.position = 'fixed';
                element.style.left = '-10000px';
                element.style.top = '0';
                element.style.width = '794px';
                element.style.backgroundColor = 'white';
                element.innerHTML = renderCardToString(student, instLogoB64, photoB64);

                document.body.appendChild(element);

                // Reduce wait time for Base64 which is already in memory
                await new Promise(r => setTimeout(r, 400));

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: false,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: 1123,
                    logging: false
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.9);

                if (i > 0) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, 297);

                document.body.removeChild(element);

                // Yield to UI
                if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
            }

            const fileName = `${currentEvent.exam_name}_Admit_Cards.pdf`;
            doc.save(fileName);
            toast.success('Professional PDF Generated');
            setIsSelectionMode(false);
            setSelectionMap({});
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setIsGeneratingPDF(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const generateZIP = async () => {
        const selectedData = filteredStudents.filter(s => selectionMap[s.id]);
        setShowExportOptions(false);

        try {
            setIsGeneratingPDF(true); // Reusing as general "isProcessing"
            setProgress({ current: 0, total: selectedData.length });

            const zip = new JSZip();
            const instLogoB64 = await toBase64(instProfile.logo_url || instProfile.institute_logo || '');

            for (let i = 0; i < selectedData.length; i++) {
                const student = selectedData[i];
                setProgress(prev => ({ ...prev, current: i + 1 }));

                const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

                const element = document.createElement('div');
                element.style.position = 'fixed';
                element.style.left = '-10000px';
                element.style.top = '0';
                element.style.width = '794px';
                element.style.backgroundColor = 'white';
                element.innerHTML = renderCardToString(student, instLogoB64, photoB64);

                document.body.appendChild(element);
                await new Promise(r => setTimeout(r, 400));

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: false,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: 1123,
                    logging: false
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
                zip.file(`${student.name}_${student.roll_no || i}.jpg`, imgData, { base64: true });

                document.body.removeChild(element);
                if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${currentEvent.exam_name}_Gallery.zip`);
            toast.success('ZIP Archive Ready');
            setIsSelectionMode(false);
            setSelectionMap({});
        } catch (error) {
            console.error('ZIP Error:', error);
            toast.error('Failed to generate ZIP');
        } finally {
            setIsGeneratingPDF(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const renderCardToString = (student, instLogoB64, photoB64) => {
        return `
            <div style="width: 794px; height: 1122px; padding: 30px; background: #ffffff; color: #000000; font-family: Arial, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                <!-- Header -->
                <div style="width: 100%; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${instLogoB64 ? `<img src="${instLogoB64}" style="height: 55px; width: auto; display: block;" />` : ''}
                            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #000; letter-spacing: -0.5px;">${(instProfile?.institute_name || 'INSTITUTE').toUpperCase()}</h1>
                        </div>
                        <div style="font-size: 14px; font-weight: 900; color: #000; background: #EEE; padding: 4px 10px; border: 1px solid #000; border-radius: 4px;">${formatDate(new Date())}</div>
                    </div>
                    <div style="text-align: center; width: 100%;">
                        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #222;">
                            ${(instProfile?.address || instProfile?.institute_address) || ''}, ${instProfile?.district || ''}, ${instProfile?.state || ''} - ${instProfile?.pincode || ''}
                        </p>
                    </div>
                </div>

                <!-- Exam Title -->
                <div style="text-align: center; margin: 10px 0 25px 0;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 900; color: #000; border: 2px solid #000; display: inline-block; padding: 8px 45px; border-radius: 6px; text-transform: uppercase;">
                        ${currentEvent.exam_name.toUpperCase()}
                    </h2>
                </div>

                <!-- Details -->
                <div style="display: flex; justify-content: space-between; gap: 30px; margin-bottom: 25px; align-items: flex-start;">
                    <div style="flex: 1;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tbody>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555; width: 150px;">STUDENT NAME</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.name}</td></tr>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">CLASS & SECTION</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.class} - ${student.section}</td></tr>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">ROLL NUMBER</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.roll_no || 'TBD'}</td></tr>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">DATE OF BIRTH</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${formatDate(student.dob)}</td></tr>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">FATHER'S NAME</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.father_name}</td></tr>
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">MOTHER'S NAME</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.mother_name || 'N/A'}</td></tr>
                                <tr><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">CONTACT INFO</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.mobile}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="width: 140px; height: 170px; border: 2.5px solid #000; padding: 2px; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        ${photoB64 ? `<img src="${photoB64}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />` : `<div style="color: #BBB; font-size: 10px; text-align: center; font-weight: bold;">AFFIX<br/>PHOTO</div>`}
                    </div>
                </div>

                <!-- Schedule -->
                <div style="margin-bottom: 25px;">
                    <h4 style="font-size: 13px; font-weight: bold; text-decoration: underline; display: inline-block; padding-bottom: 3px; margin-bottom: 10px;">EXAMINATION TIMETABLE</h4>
                    <table style="width: 100%; border-collapse: collapse; border: 2px solid #000;">
                        <thead>
                            <tr style="background: #f8fafc; color: #000; border-bottom: 2px solid #000;">
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">DATE & DAY</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">SUBJECT</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">TIME</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentEvent.schedule.map(row => `
                                <tr>
                                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight: 800; font-size: 12px;">${formatDate(row.date)} (${row.day})</td>
                                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight: 800; font-size: 12px;">${row.subject}</td>
                                    <td style="padding: 6px 8px; border: 1px solid #000; font-weight: 800; font-size: 12px;">${row.time}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Instructions -->
                <div style="border: 1.5px solid #000; padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; font-weight: 900; text-decoration: underline; margin-bottom: 5px;">INSTRUCTIONS:</div>
                    <ul style="margin: 0; padding-left: 15px; font-size: 10px; font-weight: bold; line-height: 1.3;">
                        <li>Valid Admit Card is mandatory for entry.</li>
                        <li>Report at least 20 mins before commencement.</li>
                        <li>Possession of gadgets/smartphones is banned.</li>
                        <li>Ensure invigilator's signature on this card.</li>
                    </ul>
                </div>

                <!-- Footer -->
                <div style="margin-top: auto; display: flex; justify-content: space-between; padding: 40px 20px 0 20px; width: 100%; box-sizing: border-box; position: absolute; bottom: 40px; left: 0;">
                    <div style="text-align: center; width: 220px;">
                        <div style="border-top: 2px solid #000; margin-bottom: 5px;"></div>
                        <span style="font-size: 11px; font-weight: 900;">TEACHER'S SIGNATURE</span>
                    </div>
                    <div style="text-align: center; width: 220px;">
                        <div style="border-top: 2px solid #000; margin-bottom: 5px;"></div>
                        <span style="font-size: 11px; font-weight: 900;">PRINCIPAL SIGNATURE</span>
                    </div>
                </div>
            </div>
        `;
    };

    const handleCreateEvent = async () => {
        if (!examName) return toast.warning('Enter exam name');
        if (selectedClasses.length === 0) return toast.warning('Select at least one class');
        if (schedule.some(s => !s.date || !s.subject)) return toast.warning('Fill all schedule details');

        try {
            setLoading(true);
            await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/create`, {
                exam_name: examName,
                classes: selectedClasses,
                schedule: schedule
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Admit Card Event Created!');
            setViewMode('list');
            fetchAdmitCardEvents();
            resetForm();
        } catch (error) {
            toast.error('Failed to create admit card');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setExamName('');
        setSelectedClasses([]);
        setSchedule([{ date: '', day: '', subject: '', time: '' }]);
        setCreationStep(1);
    };

    const handleViewEvent = async (event) => {
        setCurrentEvent(event);
        setViewMode('event-details');
        try {
            setLoading(true);
            const response = await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/students`, {
                classes: event.classes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudents(response.data);
            const firstClass = event.classes[0];
            if (firstClass) {
                setActiveClassTab(`${firstClass.class}-${firstClass.section}`);
                setFilteredStudents(response.data.filter(s => s.class === firstClass.class && s.section === firstClass.section));
            }
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (cs) => {
        const key = `${cs.class}-${cs.section}`;
        setActiveClassTab(key);
        setFilteredStudents(students.filter(s => s.class === cs.class && s.section === cs.section));
    };

    const handleDeleteEvent = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this admit card event?')) return;
        try {
            await axios.delete(`${API_ENDPOINTS.ADMIT_CARD}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Deleted');
            fetchAdmitCardEvents();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 500);
    };

    // Render logic for different modes
    const renderCreateDialog = () => (
        <div className="creation-overlay no-print">
            <div className="creation-flow-card">
                <header className="creation-header">
                    <h3>{creationStep === 1 ? 'Configure Exam Basics' : 'Build Exam Schedule'}</h3>
                    <button className="close-btn" onClick={() => { setViewMode('list'); resetForm(); }}>✕</button>
                </header>

                <div className="creation-content">
                    <div className="flow-stepper">
                        <div className={`step-indicator ${creationStep >= 1 ? 'active' : ''}`}></div>
                        <div className={`step-indicator ${creationStep === 2 ? 'active' : ''}`}></div>
                    </div>

                    {creationStep === 1 ? (
                        <div className="form-section fadeIn">
                            <div className="form-group-modern">
                                <label>Title of the Examination</label>
                                <input
                                    type="text"
                                    className="premium-input"
                                    placeholder="e.g. Annual Term Final - 2026"
                                    value={examName}
                                    onChange={(e) => setExamName(e.target.value)}
                                />
                            </div>

                            <div className="form-group-modern">
                                <label>Target Classes & Sections</label>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>Pick the classes this schedule applies to:</p>
                                <div className="class-chips-box">
                                    {availableClassSections.map((cs, i) => {
                                        const isSelected = selectedClasses.some(item => item.class === cs.class && item.section === cs.section);
                                        return (
                                            <div
                                                key={i}
                                                className={`pill-chip ${isSelected ? 'selected' : ''}`}
                                                onClick={() => handleClassToggle(cs)}
                                            >
                                                Class {cs.class} - {cs.section}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="form-section fadeIn">
                            <div className="schedule-list">
                                {schedule.map((row, i) => (
                                    <div key={i} className="schedule-row-card">
                                        <div className="form-group-modern">
                                            <span className="tiny-label">Date</span>
                                            <input type="date" className="premium-input-small" value={row.date} onChange={(e) => updateScheduleRow(i, 'date', e.target.value)} />
                                        </div>
                                        <div className="form-group-modern">
                                            <span className="tiny-label">Day</span>
                                            <input type="text" className="premium-input-small" readOnly placeholder="Auto" value={row.day} style={{ opacity: 0.7 }} />
                                        </div>
                                        <div className="form-group-modern">
                                            <span className="tiny-label">Subject</span>
                                            <input type="text" className="premium-input-small" placeholder="Subject Name" value={row.subject} onChange={(e) => updateScheduleRow(i, 'subject', e.target.value)} />
                                        </div>
                                        <div className="form-group-modern">
                                            <span className="tiny-label">Timing</span>
                                            <input type="text" className="premium-input-small" placeholder="e.g. 10 AM - 1 PM" value={row.time} onChange={(e) => updateScheduleRow(i, 'time', e.target.value)} />
                                        </div>
                                        <button className="row-delete-icon" onClick={() => removeScheduleRow(i)}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button className="add-subject-btn" onClick={addScheduleRow}>+ Add New Exam Date / Subject</button>
                        </div>
                    )}

                    <footer className="footer-action-bar">
                        {creationStep === 1 ? (
                            <>
                                <button className="btn-secondary" onClick={() => setViewMode('list')}>Cancel</button>
                                <button className="btn-primary-gradient" onClick={() => (examName && selectedClasses.length > 0) ? setCreationStep(2) : toast.warning('Missing info')}>
                                    Next: Schedule Details ➔
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn-secondary" onClick={() => setCreationStep(1)}>⇠ Back to Basics</button>
                                <button className="btn-success" onClick={handleCreateEvent}>
                                    {loading ? 'Processing...' : 'Finalize & Generate Cards ⚡️'}
                                </button>
                            </>
                        )}
                    </footer>
                </div>
            </div>
        </div>
    );

    const renderAdmitCardViewer = () => {
        if (!selectedStudent || !instProfile) return null;

        return (
            <div className="admit-card-viewer no-print" style={{ position: 'relative', padding: '60px 20px' }}>
                <div className="viewer-actions no-print" style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 100 }}>
                    <button className="btn-secondary" onClick={() => setViewMode('event-details')}>⇠ Back to Students</button>
                </div>

                <div id="printable-area">
                    <div className="professional-card-print">
                        {/* Header Section - Modern Institutional Layout */}
                        <div className="card-top-header" style={{ position: 'relative', marginBottom: '30px' }}>
                            {/* Top row: Logo+Name and Date */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, overflow: 'hidden' }}>
                                    {instProfile.logo_url || instProfile.institute_logo ? (
                                        <img
                                            src={instProfile.logo_url || instProfile.institute_logo}
                                            alt="Logo"
                                            style={{ height: '45px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                                        />
                                    ) : null}
                                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#000' }}>
                                        {instProfile.institute_name.toUpperCase()}
                                    </h1>
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: '900', color: '#000', whiteSpace: 'nowrap', marginLeft: '20px' }}>
                                    {formatDate(new Date())}
                                </div>
                            </div>

                            {/* Middle row: Centered Address */}
                            <div style={{ textAlign: 'center', marginTop: '12px', width: '100%' }}>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#333' }}>
                                    {instProfile.address || instProfile.institute_address}, {instProfile.district}, {instProfile.state} - {instProfile.pincode}
                                </p>
                            </div>

                            <div className="header-divider-line" style={{ height: '3px', background: '#000', width: '100%', margin: '15px 0' }}></div>

                            <div className="exam-banner-title" style={{ textAlign: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', letterSpacing: '1.5px', color: '#000' }}>
                                    {currentEvent.exam_name.toUpperCase()}
                                </h2>
                            </div>
                        </div>

                        {/* Student Details Section */}
                        <div className="student-info-section" style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '30px', marginBottom: '30px' }}>
                            <div className="details-column-left">
                                <table className="details-table-simple">
                                    <tbody>
                                        <tr><td>STUDENT NAME</td><td>{selectedStudent.name}</td></tr>
                                        <tr><td>CLASS & SECTION</td><td>{selectedStudent.class} - {selectedStudent.section}</td></tr>
                                        <tr><td>ROLL NUMBER</td><td>{selectedStudent.roll_no || 'TBD'}</td></tr>
                                        <tr><td>DATE OF BIRTH</td><td>{formatDate(selectedStudent.dob)}</td></tr>
                                        <tr><td>FATHER'S NAME</td><td>{selectedStudent.father_name}</td></tr>
                                        <tr><td>MOTHER'S NAME</td><td>{selectedStudent.mother_name || 'N/A'}</td></tr>
                                        <tr><td>CONTACT MOBILE</td><td>{selectedStudent.mobile}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="photo-container-right" style={{ textAlign: 'center' }}>
                                <div className="photo-box-card" style={{ width: '150px', height: '180px', border: '2px solid #000', margin: '0 auto' }}>
                                    {selectedStudent.photo_url ? (
                                        <img src={selectedStudent.photo_url} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', fontSize: '10px', color: '#999', textAlign: 'center' }}>
                                            AFFIX<br />PHOTO<br />HERE
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Schedule Table */}
                        <div className="exam-schedule-container">
                            <table className="exam-schedule-table" style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', color: '#000', borderBottom: '2px solid #000' }}>
                                        <th style={{ padding: '12px', fontSize: '12px', textAlign: 'left' }}>DATE</th>
                                        <th style={{ padding: '12px', fontSize: '12px', textAlign: 'left' }}>DAY</th>
                                        <th style={{ padding: '12px', fontSize: '12px', textAlign: 'left' }}>SUBJECT</th>
                                        <th style={{ padding: '12px', fontSize: '12px', textAlign: 'left' }}>TIME/SHIFT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentEvent.schedule.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700' }}>{formatDate(row.date)}</td>
                                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700' }}>{row.day}</td>
                                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700' }}>{row.subject}</td>
                                            <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700' }}>{row.time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Instructions Section */}
                        <div className="admit-instructions-box" style={{ marginTop: '30px' }}>
                            <h4 style={{ fontSize: '12px', fontWeight: '900', textDecoration: 'underline', marginBottom: '10px' }}>INSTRUCTIONS:</h4>
                            <ul style={{ paddingLeft: '18px', margin: '0' }}>
                                <li style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Possession of this card is mandatory for entry into the examination hall.</li>
                                <li style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Candidates must arrive at the examination center at least 20 minutes before the start time.</li>
                                <li style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Electronic devices, digital calculators, and smartwatches are strictly prohibited.</li>
                                <li style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>Ensure this card is signed by the authorized officials.</li>
                            </ul>
                        </div>

                        {/* Signatures Area */}
                        <div className="card-footer-signatures" style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div style={{ textAlign: 'center', width: '200px' }}>
                                <div style={{ borderTop: '2px solid #000', marginBottom: '8px' }}></div>
                                <span style={{ fontSize: '12px', fontWeight: '900' }}>TEACHER'S SIGNATURE</span>
                            </div>
                            <div style={{ textAlign: 'center', width: '200px' }}>
                                <div style={{ borderTop: '2px solid #000', marginBottom: '8px' }}></div>
                                <span style={{ fontSize: '12px', fontWeight: '900' }}>PRINCIPAL SIGNATURE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="admit-card-container">
            {viewMode === 'create' && renderCreateDialog()}
            {viewMode === 'individual' && selectedStudent && renderAdmitCardViewer()}

            {viewMode === 'list' && (
                <header className="page-header">
                    <div>
                        <h2>Admit Card Registry</h2>
                        <p>Standardized examination identification management</p>
                    </div>
                    <button className="btn-primary-gradient" onClick={() => setViewMode('create')}>
                        + Initialize New Exam Event
                    </button>
                </header>
            )}

            <div className="content-space">
                {viewMode === 'list' && (
                    <div className="events-grid">
                        {loading ? (
                            <div className="loader-box">Loading...</div>
                        ) : admitCardEvents.map(event => (
                            <div key={event.id} className="exam-event-card fadeIn" onClick={() => handleViewEvent(event)}>
                                <div className="event-icon-box">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg>
                                </div>
                                <div className="event-title-stack">
                                    <h3>{event.exam_name}</h3>
                                    <p>{event.classes?.map(c => `Cl-${c.class}${c.section}`).join(', ')}</p>
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>STATIONARY READY</span>
                                    <button className="row-delete-icon" onClick={(e) => handleDeleteEvent(event.id, e)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {viewMode === 'event-details' && currentEvent && (
                    <div className="fadeIn">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <button className="btn-secondary" onClick={() => { setViewMode('list'); setIsSelectionMode(false); }}>⇠ Back to Registry</button>
                                <h2 style={{ margin: 0 }}>{currentEvent.exam_name}</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {!isSelectionMode ? (
                                    <button
                                        className="btn-primary-gradient"
                                        onClick={() => setIsSelectionMode(true)}
                                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
                                    >
                                        Bulk Share / Generate 📄
                                    </button>
                                ) : (
                                    <>
                                        <button className="btn-secondary" onClick={() => { setIsSelectionMode(false); setSelectionMap({}); }}>Cancel Selection</button>
                                        <button
                                            className={`pill-chip ${filteredStudents.every(s => selectionMap[s.id]) ? 'selected' : ''}`}
                                            onClick={toggleSelectAll}
                                            style={{ height: 'auto', padding: '10px 20px' }}
                                        >
                                            {filteredStudents.every(s => selectionMap[s.id]) ? 'Unselect All' : 'Select All Clients'}
                                        </button>
                                        {getSelectedCount() > 0 && (
                                            <button
                                                className="btn-primary-gradient"
                                                onClick={handleBulkShare}
                                                disabled={isGeneratingPDF}
                                                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                                            >
                                                {isGeneratingPDF ? 'Generating...' : `Download ${getSelectedCount()} Cards ⚡️`}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="class-selection-area" style={{ marginTop: 0, marginBottom: '30px' }}>
                            <div className="class-chips-box">
                                {currentEvent.classes.map((cs, i) => {
                                    const key = `${cs.class}-${cs.section}`;
                                    return (
                                        <div
                                            key={i}
                                            className={`pill-chip ${activeClassTab === key ? 'selected' : ''}`}
                                            onClick={() => handleTabChange(cs)}
                                        >
                                            Class {cs.class}{cs.section}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {loading ? <p>Syncing students...</p> : (
                            <div className="events-grid">
                                {filteredStudents.map(student => (
                                    <div
                                        key={student.id}
                                        className={`exam-event-card ${isSelectionMode && selectionMap[student.id] ? 'selected-card' : ''}`}
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                toggleStudentSelection(student.id, { stopPropagation: () => { } });
                                            } else {
                                                setSelectedStudent(student);
                                                setViewMode('individual');
                                            }
                                        }}
                                        style={{ position: 'relative', cursor: 'pointer' }}
                                    >
                                        {isSelectionMode && (
                                            <div
                                                className="card-checkbox"
                                                onClick={(e) => toggleStudentSelection(student.id, e)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '15px',
                                                    right: '15px',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '6px',
                                                    border: '2px solid #6366f1',
                                                    background: selectionMap[student.id] ? '#6366f1' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    zIndex: 5
                                                }}
                                            >
                                                {selectionMap[student.id] && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                            <div className="event-icon-box" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
                                                {student.photo_url ? <img src={student.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} alt="" /> : (student.name ? student.name[0] : '?')}
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0 }}>{student.name}</h4>
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>Roll: {student.roll_no}</span>
                                            </div>
                                        </div>
                                        {!isSelectionMode && (
                                            <button className="btn-secondary" style={{ width: '100%', fontSize: '12px', padding: '8px', marginTop: '10px' }}>
                                                View Admit Card
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Global Processing UI */}
            {isGeneratingPDF && (
                <div className="id-global-overlay">
                    <div className="id-pulse-loader"></div>
                    <div className="progress-container-pro fadeIn">
                        <div className="progress-text-main">
                            {Math.round((progress.current / progress.total) * 100)}%
                        </div>
                        <div className="progress-sub">
                            Digitizing Admit Card {progress.current} of {progress.total}
                        </div>
                        <div className="progress-track-pro">
                            <div
                                className="progress-fill-pro"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            High-Fidelity Rendering in Progress
                        </div>
                    </div>
                </div>
            )}

            {/* Export Format Selector */}
            {showExportOptions && (
                <div className="export-modal-overlay" onClick={() => setShowExportOptions(false)}>
                    <div className="export-modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', color: 'white' }}>Format Selection</h2>
                        <p style={{ margin: '0 0 2.5rem', opacity: 0.6 }}>Choose how you'd like to bundle these {getSelectedCount()} identities</p>

                        <div className="export-options">
                            <div className="export-option-card" onClick={generatePDF}>
                                <div className="export-option-icon">📄</div>
                                <div className="export-option-text">
                                    <div style={{ color: 'white' }}>Single Document (PDF)</div>
                                    <div>Perfect for office printing</div>
                                </div>
                            </div>

                            <div className="export-option-card" onClick={generateZIP}>
                                <div className="export-option-icon">📦</div>
                                <div className="export-option-text">
                                    <div style={{ color: 'white' }}>Image Gallery (ZIP)</div>
                                    <div>Individual student photo cards</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdmitCard;
