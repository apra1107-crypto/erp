import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BASE_URL } from '../config';
import './IDCardView.css';

const IDCardView = ({ userData }) => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [selectedSection, setSelectedSection] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Selection states
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showExportOptions, setShowExportOptions] = useState(false);

    // Manual Sizing States
    const [cardScale, setCardScale] = useState(1);
    const [cardWidth, setCardWidth] = useState(360);
    const [cardHeight, setCardHeight] = useState(180);

    useEffect(() => {
        fetchStudents();
        const savedWidth = localStorage.getItem('id_card_width');
        const savedHeight = localStorage.getItem('id_card_height');
        const savedScale = localStorage.getItem('id_card_scale');
        if (savedWidth) setCardWidth(parseInt(savedWidth));
        if (savedHeight) setCardHeight(parseInt(savedHeight));
        if (savedScale) setCardScale(parseFloat(savedScale));
    }, []);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const userType = localStorage.getItem('userType');
            let endpoint = `${API_ENDPOINTS.TEACHER}/student/list`;

            if (userType === 'principal') {
                endpoint = `${API_ENDPOINTS.PRINCIPAL}/student/list`;
            }

            const response = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudents(response.data.students || []);
        } catch (error) {
            console.error('Fetch students error:', error);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSize = () => {
        localStorage.setItem('id_card_width', cardWidth);
        localStorage.setItem('id_card_height', cardHeight);
        localStorage.setItem('id_card_scale', cardScale);
        toast.success('Layout Saved Successfully');
    };

    // Selection Helpers
    const toggleSelectAll = (filteredStudents) => {
        if (selectedIds.size === filteredStudents.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredStudents.map(s => s.id)));
        }
    };

    const toggleSelectOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
        setShowExportOptions(false);
    };

    // --- HIGH SPEED ASSET HANDLING ---
    const toBase64 = (url) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            // Use same proxy as Admit Card for high speed bypass of CORS/S3 rules
            const absoluteUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
            const finalUrl = `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(absoluteUrl)}`;

            img.src = finalUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(null);
        });
    };

    // Capture/Export Logic
    const captureStudentCard = async (student, instLogoB64, studentPhotoB64) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-3000px';
        container.style.top = '0';
        container.style.zIndex = '-999';
        container.style.background = '#ffffff'; // Ensure no transparency leakage
        document.body.appendChild(container);

        const html = `
            <div style="width: ${cardWidth}px; min-height: ${cardHeight}px; background: #ffffff !important; border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-family: Arial, sans-serif; color: #000;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 5px 12px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ${instLogoB64 ? `<img src="${instLogoB64}" style="width: 25px; height: 25px; object-fit: contain;">` : `<div style="font-size: 14px; font-weight: 900; color: white;">${userData?.institute_name?.charAt(0)}</div>`}
                    <h2 style="margin: 0; font-size: 11px; font-weight: 900; color: white; text-transform: uppercase;">${userData?.institute_name}</h2>
                </div>
                <div style="background: #ffffff; padding: 5px 10px; text-align: center; color: #000; font-size: 7.2px; font-weight: 800; border-bottom: 1.2px solid #e2e8f0; letter-spacing: 0.1px;">
                    ${userData?.institute_address || userData?.address}, ${userData?.district} - ${userData?.pincode}
                </div>
                <div style="padding: 10px 12px; display: flex; gap: 15px; background: #ffffff;">
                    <div style="flex: 1;">
                        <div style="margin-bottom: 5px;">
                            <label style="font-size: 6.5px; color: #000; font-weight: 950; text-transform: uppercase; display: block; letter-spacing: 0.2px;">Student Name</label>
                            <span style="font-size: 11px; color: #000; font-weight: 950; text-transform: uppercase;">${student.name}</span>
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 5px;">
                            <div><label style="font-size: 6.5px; font-weight: 950; text-transform: uppercase;">Class</label><div style="font-size: 9.5px; font-weight: 950;">${student.class}</div></div>
                            <div><label style="font-size: 6.5px; font-weight: 950; text-transform: uppercase;">Sec</label><div style="font-size: 9.5px; font-weight: 950;">${student.section}</div></div>
                            <div><label style="font-size: 6.5px; font-weight: 950; text-transform: uppercase;">Roll</label><div style="font-size: 9.5px; font-weight: 950;">${student.roll_no}</div></div>
                        </div>
                        <div style="border-top: 1.2px solid #e2e8f0; padding-top: 5px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                            <div><label style="font-size: 6.2px; font-weight: 950; text-transform: uppercase;">Father</label><div style="font-size: 8.5px; color: #000; font-weight: 950;">${student.father_name}</div></div>
                            <div><label style="font-size: 6.2px; font-weight: 950; text-transform: uppercase;">Mother</label><div style="font-size: 8.5px; color: #000; font-weight: 950;">${student.mother_name || 'N/A'}</div></div>
                            <div><label style="font-size: 6.2px; font-weight: 950; text-transform: uppercase;">DOB</label><div style="font-size: 8.5px; color: #000; font-weight: 950;">${student.dob}</div></div>
                            <div><label style="font-size: 6.2px; font-weight: 950; text-transform: uppercase;">Contact</label><div style="font-size: 8.5px; color: #000; font-weight: 950;">${student.mobile}</div></div>
                        </div>
                    </div>
                    <div style="width: 82px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
                        <div style="height: 82px; width: 82px; border: 1.5px solid #e2e8f0; border-radius: 4px; overflow: hidden; background: #fff; flex-shrink: 0;">
                            ${studentPhotoB64 ? `<img src="${studentPhotoB64}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #ccc;">👤</div>`}
                        </div>
                        <div style="width: 100%;">
                            <label style="font-size: 6.5px; font-weight: 950; display: block; margin-bottom: 2px; text-transform: uppercase;">Address</label>
                            <div style="font-size: 6.8px; font-weight: 950; line-height: 1.1; word-break: break-all;">${student.address}</div>
                        </div>
                    </div>
                </div>
                <div style="background: #ffffff; border-top: 1.2px solid #e2e8f0; padding: 5px; text-align: center; color: #000; font-size: 8px; font-weight: 950; letter-spacing: 1.5px; text-transform: uppercase;">
                    STUDENT IDENTITY CARD
                </div>
            </div>
        `;

        container.innerHTML = html;

        // No wait needed for Base64 images as they are already loaded in memory
        const canvas = await html2canvas(container, {
            useCORS: false,
            scale: 2.5,
            backgroundColor: '#ffffff', // Force white to prevent black JPEG artifacts
            logging: false,
            removeContainer: true
        });

        document.body.removeChild(container);
        return canvas;
    };

    const generateZIP = async () => {
        const selectedStudents = students.filter(s => selectedIds.has(s.id));
        setProcessing(true);
        setProgress({ current: 0, total: selectedStudents.length });

        const zip = new JSZip();
        try {
            // Fetch Institute Logo Base64 once to reuse for all cards (MASSIVE SPEEDUP)
            const instLogoB64 = await toBase64(userData.institute_logo || userData.logo_url);

            for (let i = 0; i < selectedStudents.length; i++) {
                const student = selectedStudents[i];
                setProgress(prev => ({ ...prev, current: i + 1 }));

                // Pre-convert student photo to Base64
                const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

                const canvas = await captureStudentCard(student, instLogoB64, photoB64);
                const imgData = canvas.toDataURL('image/jpeg', 1.0).split(',')[1];
                zip.file(`${student.name}_${student.roll_no}.jpg`, imgData, { base64: true });

                // Very small yield to allow UI update
                if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
            }

            const content = await zip.generateAsync({ type: 'blob', compression: "STORE" });
            saveAs(content, `IDs_Batch_${selectedSection.class}_${selectedSection.section}.zip`);
            cancelSelection();
            toast.success('Batch Exported Successfully');
        } catch (error) {
            console.error(error);
            toast.error('Export Interrupted');
        } finally {
            setProcessing(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const generatePDF = async () => {
        const selectedStudents = students.filter(s => selectedIds.has(s.id));
        setProcessing(true);
        setProgress({ current: 0, total: selectedStudents.length });

        const pdf = new jsPDF('p', 'mm', 'a4');
        try {
            // Pre-convert institute logo
            const instLogoB64 = await toBase64(userData.institute_logo || userData.logo_url);

            const cardWidthMM = 130;  // Wider for better 2-per-page layout
            const cardHeightMM = 85;  // Adjust height proportionally
            const marginX = (210 - cardWidthMM) / 2; // Center horizontally
            const marginY = (297 - (cardHeightMM * 2)) / 3; // Even vertical spacing for two

            for (let i = 0; i < selectedStudents.length; i++) {
                const student = selectedStudents[i];
                setProgress(prev => ({ ...prev, current: i + 1 }));

                if (i > 0 && i % 2 === 0) pdf.addPage();

                const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;
                const canvas = await captureStudentCard(student, instLogoB64, photoB64);

                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                const posInPage = i % 2;
                const row = posInPage;

                pdf.addImage(imgData, 'JPEG', marginX, marginY + (row * (cardHeightMM + marginY)), cardWidthMM, cardHeightMM);

                if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
            }

            pdf.save(`IDs_Document_${selectedSection.class}_${selectedSection.section}.pdf`);
            cancelSelection();
            toast.success('PDF Document Ready');
        } catch (error) {
            console.error(error);
            toast.error('PDF Generation Failed');
        } finally {
            setProcessing(false);
            setProgress({ current: 0, total: 0 });
        }
    };

    const sections = students.reduce((acc, student) => {
        const key = `${student.class}-${student.section}`;
        if (!acc[key]) acc[key] = { class: student.class, section: student.section, count: 0 };
        acc[key].count++;
        return acc;
    }, {});

    const sectionList = Object.values(sections).sort((a, b) => {
        if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
        return a.section.localeCompare(b.section);
    });

    if (loading || processing) return (
        <div className="id-global-overlay">
            <div className="id-pulse-loader"></div>

            {processing && progress.total > 0 && (
                <div className="progress-container-pro fadeIn">
                    <div className="progress-text-main">
                        {Math.round((progress.current / progress.total) * 100)}%
                    </div>
                    <div className="progress-sub">
                        Generating Digital Identity {progress.current} of {progress.total}
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
            )}

            {!processing && <p className="fadeIn">Synchronizing Student Records...</p>}
        </div>
    );

    // VIEW 3: CARD VIEWER (EDITOR)
    if (selectedStudent) {
        return (
            <div className="id-card-view-container">
                <header className="selection-top-bar">
                    <div className="selection-title-group">
                        <button className="back-btn-classic" onClick={() => setSelectedStudent(null)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="selection-stats">
                            <h3>Identity Preview</h3>
                            <span>Official Record for {selectedStudent.name}</span>
                        </div>
                    </div>
                </header>

                <div className="id-preview-stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem' }}>
                    <div style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.12)', borderRadius: '12px' }}>
                        <StudentIDCard student={selectedStudent} userData={userData} customWidth={cardWidth} customHeight={cardHeight} />
                    </div>
                </div>
            </div>
        );
    }

    // VIEW 2: STUDENT SELECTION LIST
    if (selectedSection) {
        let filteredStudents = students.filter(s => s.class === selectedSection.class && s.section === selectedSection.section);
        const allSelected = selectedIds.size === filteredStudents.length && filteredStudents.length > 0;

        return (
            <div className="id-card-view-container">
                <header className="selection-top-bar">
                    <div className="selection-title-group">
                        <button className="back-btn-classic" onClick={() => { setSelectedSection(null); cancelSelection(); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="selection-stats">
                            <h3>Grade {selectedSection.class} - {selectedSection.section}</h3>
                            <span>{filteredStudents.length} Students Enrolled</span>
                        </div>
                    </div>

                    <div className="header-actions">
                        {!selectionMode ? (
                            <button className="id-share-btn" onClick={() => setSelectionMode(true)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
                                Share Multiple
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={() => toggleSelectAll(filteredStudents)}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    Select All
                                </label>
                                <button className="batch-btn-cancel" onClick={cancelSelection}>Discard Selection</button>
                                <button className="id-share-btn" onClick={() => selectedIds.size > 0 ? setShowExportOptions(true) : toast.info('Select students first')}>
                                    Process {selectedIds.size} Cards
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="student-list-container">
                    <div className="id-student-grid">
                        {filteredStudents.map(student => (
                            <div
                                key={student.id}
                                className={`id-student-card ${selectedIds.has(student.id) ? 'selected' : ''}`}
                                onClick={() => selectionMode ? toggleSelectOne(student.id) : setSelectedStudent(student)}
                            >
                                {selectionMode && (
                                    <div className="card-checkbox-corner">
                                        {selectedIds.has(student.id) && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </div>
                                )}
                                <div className="id-student-avatar">
                                    {student.photo_url ? (
                                        <img src={student.photo_url} alt={student.name} />
                                    ) : (
                                        <span>{student.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="id-student-info">
                                    <h3>{student.name}</h3>
                                    <p>Roll No: {student.roll_no}</p>
                                </div>
                                <div className="id-student-action">
                                    {selectionMode ? (
                                        <span className={`select-label ${selectedIds.has(student.id) ? 'active' : ''}`}>
                                            {selectedIds.has(student.id) ? 'Selected' : 'Select'}
                                        </span>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {showExportOptions && (
                    <div className="id-global-overlay" onClick={() => setShowExportOptions(false)}>
                        <div className="export-modal" onClick={e => e.stopPropagation()} style={{ background: 'var(--card-dark)', padding: '3rem', borderRadius: '32px', width: '450px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>Export Identities</h2>
                            <p style={{ margin: '0 0 2.5rem', opacity: 0.6 }}>Choose a format for {selectedIds.size} students</p>

                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div onClick={generatePDF} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}>
                                    <span style={{ fontSize: '2rem' }}>📄</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '700' }}>Printable PDF</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Formatted for A4 Sheets (4 IDs/page)</div>
                                    </div>
                                </div>
                                <div onClick={generateZIP} style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}>
                                    <span style={{ fontSize: '2rem' }}>📦</span>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '700' }}>Image Gallery (ZIP)</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Individual high-res JPG images</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // VIEW 1: FLASHCARDS (MINIMALIST)
    return (
        <div className="id-card-view-container">
            <header className="id-view-header">
                <h2>Identity Credentials</h2>
                <p>Browse through sections to manage and export official student IDs</p>
            </header>

            <div className="id-section-grid">
                {sectionList.map(sec => (
                    <div key={`${sec.class}-${sec.section}`} className="id-section-flashcard" onClick={() => setSelectedSection(sec)}>
                        <div className="flash-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </div>
                        <div className="flash-content">
                            <span className="student-count-tag">{sec.count} Students</span>
                            <h3>Class {sec.class} - {sec.section}</h3>
                        </div>
                        <div className="flash-arrow">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StudentIDCard = ({ student, userData, customWidth, customHeight }) => {
    const instName = userData?.institute_name || "INSTITUTE NAME";
    const instLogo = userData?.institute_logo || userData?.logo_url || null;
    const instAddr = userData?.institute_address || userData?.address || "";
    const instDistrict = userData?.district || "";
    const instPincode = userData?.pincode || "";

    return (
        <div className="printable-card" style={{
            width: customWidth ? `${customWidth}px` : '360px',
            minHeight: customHeight ? `${customHeight}px` : 'auto',
            backgroundColor: '#ffffff',
            border: '1.5px solid #e2e8f0', // Switch to clean white/gray border
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
            fontFamily: 'Arial, sans-serif',
            color: '#000'
        }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                {instLogo ? <img src={instLogo} style={{ width: '25px', height: '25px', objectFit: 'contain' }} /> : <div style={{ fontSize: '14px', fontWeight: '900', color: 'white' }}>{instName.charAt(0)}</div>}
                <h2 style={{ margin: '0', fontSize: '11px', fontWeight: '900', color: 'white', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{instName}</h2>
            </div>
            <div style={{ background: '#ffffff', padding: '4px 10px', textAlign: 'center', color: '#000', fontSize: '7.2px', fontWeight: '800', borderBottom: '1.2px solid #e2e8f0', letterSpacing: '0.1px' }}>
                {instAddr}{instDistrict && `, ${instDistrict}`}{instPincode && ` - ${instPincode}`}
            </div>
            <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: '5px' }}>
                            <label style={{ fontSize: '6.5px', color: '#000', fontWeight: '950', textTransform: 'uppercase', display: 'block', letterSpacing: '0.2px' }}>Student Name</label>
                            <span style={{ fontSize: '11px', color: '#000', fontWeight: '950', textTransform: 'uppercase' }}>{student.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '6.5px', color: '#000', fontWeight: '950', textTransform: 'uppercase', display: 'block' }}>Class</label>
                                <span style={{ fontSize: '9.5px', color: '#000', fontWeight: '950' }}>{student.class}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '6.5px', color: '#000', fontWeight: '950', textTransform: 'uppercase', display: 'block' }}>Sec</label>
                                <span style={{ fontSize: '9.5px', color: '#000', fontWeight: '950' }}>{student.section}</span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '6.5px', color: '#000', fontWeight: '950', textTransform: 'uppercase', display: 'block' }}>Roll</label>
                                <span style={{ fontSize: '9.5px', color: '#000', fontWeight: '950' }}>{student.roll_no}</span>
                            </div>
                        </div>
                        <div style={{ borderTop: '1.2px solid #e2e8f0', paddingTop: '5px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            <div><label style={{ fontSize: '6.2px', color: '#000', fontWeight: '950', textTransform: 'uppercase' }}>Father</label><div style={{ fontSize: '8.5px', color: '#000', fontWeight: '950' }}>{student.father_name}</div></div>
                            <div><label style={{ fontSize: '6.2px', color: '#000', fontWeight: '950', textTransform: 'uppercase' }}>Mother</label><div style={{ fontSize: '8.5px', color: '#000', fontWeight: '950' }}>{student.mother_name || 'N/A'}</div></div>
                            <div><label style={{ fontSize: '6.2px', color: '#000', fontWeight: '950', textTransform: 'uppercase' }}>DOB</label><div style={{ fontSize: '8.5px', color: '#000', fontWeight: '950' }}>{student.dob}</div></div>
                            <div><label style={{ fontSize: '6.2px', color: '#000', fontWeight: '950', textTransform: 'uppercase' }}>Contact</label><div style={{ fontSize: '8.5px', color: '#000', fontWeight: '950' }}>{student.mobile}</div></div>
                        </div>
                    </div>
                    <div style={{ flex: '0 0 82px', width: '82px', maxWidth: '82px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ height: '82px', width: '82px', border: '1.5px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#fff', flexShrink: 0 }}>
                            {student.photo_url ? <img src={student.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#ccc' }}>👤</div>}
                        </div>
                        <div style={{ width: '100%' }}>
                            <label style={{ fontSize: '6.5px', color: '#000', fontWeight: '950', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Address</label>
                            <div style={{ fontSize: '6.8px', color: '#000', fontWeight: '950', lineHeight: '1.1', wordBreak: 'break-all', textAlign: 'left', width: '100%' }}>{student.address}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ background: '#ffffff', borderTop: '1.2px solid #e2e8f0', padding: '5px', textAlign: 'center', color: '#000', fontSize: '8px', fontWeight: '950', letterSpacing: '1.5px', textTransform: 'uppercase' }}>STUDENT IDENTITY CARD</div>
        </div>
    );
};

export default IDCardView;
