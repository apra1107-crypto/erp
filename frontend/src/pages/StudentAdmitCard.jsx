import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { API_ENDPOINTS, BASE_URL } from '../config';
import './AdmitCard.css';

const StudentAdmitCard = () => {
    const rawData = localStorage.getItem('userData');
    const student = rawData ? JSON.parse(rawData) : null;
    const token = localStorage.getItem('token');

    const getFullUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);

    useEffect(() => {
        fetchMyAdmitCards();
    }, []);

    const fetchMyAdmitCards = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/my-cards`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents(response.data);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to load admit cards');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const toBase64 = (url) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
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

    const renderCardToString = (event, instLogoB64, photoB64) => {
        return `
            <div style="width: 794px; height: 1122px; padding: 30px; background: #ffffff; color: #000000; font-family: Arial, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden;">
                <!-- Header -->
                <div style="width: 100%; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            ${instLogoB64 ? `<img src="${instLogoB64}" style="height: 55px; width: auto; display: block;" />` : ''}
                            <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #000; letter-spacing: -0.5px;">${event.institute_name.toUpperCase()}</h1>
                        </div>
                        <div style="font-size: 14px; font-weight: 900; color: #000; background: #EEE; padding: 4px 10px; border: 1px solid #000; border-radius: 4px;">${formatDate(new Date())}</div>
                    </div>
                    <div style="text-align: center; width: 100%;">
                        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #222;">
                            ${event.institute_address}, ${event.district}, ${event.state} - ${event.pincode}
                        </p>
                    </div>
                </div>

                <!-- Exam Title -->
                <div style="text-align: center; margin: 10px 0 25px 0;">
                    <h2 style="margin: 0; font-size: 22px; font-weight: 900; color: #000; border: 2px solid #000; display: inline-block; padding: 8px 45px; border-radius: 6px; text-transform: uppercase;">
                        ${event.exam_name.toUpperCase()}
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
                                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-size: 12px; font-weight: bold; color: #555;">CONTACT INFO</td><td style="padding: 8px 0; font-size: 14px; font-weight: 900; color: #000;">${student.mobile}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="width: 140px; height: 170px; border: 2.5px solid #000; padding: 2px; background: #fff; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        ${photoB64 ? `<img src="${photoB64}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />` : `<div style="color: #BBB; font-size: 10px; text-align: center; font-weight: bold;">AFFIX<br/>PHOTO</div>`}
                    </div>
                </div>

                <!-- Schedule -->
                <div style="margin-bottom: 25px;">
                    <h4 style="font-size: 13px; font-weight: bold; border-bottom: 2px solid #000; display: inline-block; padding-bottom: 3px; margin-bottom: 10px;">EXAMINATION TIMETABLE</h4>
                    <table style="width: 100%; border-collapse: collapse; border: 2px solid #000;">
                        <thead>
                            <tr style="background: #000; color: #FFF;">
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">DATE & DAY</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">SUBJECT</th>
                                <th style="padding: 8px; border: 1px solid #000; text-align: left; font-size: 11px;">TIME</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${event.schedule.map(row => `
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

    const handleDownloadPDF = async () => {
        if (!selectedEvent) return;
        setShowExportOptions(false);

        try {
            setIsProcessing(true);
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            toast.info("Preparing your official admit card PDF...");

            const instLogoB64 = await toBase64(selectedEvent.institute_logo || '');
            const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

            const element = document.createElement('div');
            element.style.position = 'fixed';
            element.style.left = '-10000px';
            element.style.top = '0';
            element.style.width = '794px';
            element.style.backgroundColor = 'white';
            element.innerHTML = renderCardToString(selectedEvent, instLogoB64, photoB64);
            document.body.appendChild(element);

            await new Promise(r => setTimeout(r, 850));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, 297);
            document.body.removeChild(element);

            const fileName = `${selectedEvent.exam_name}_Admit_Card.pdf`;
            doc.save(fileName);
            toast.success('PDF Downloaded successfully');
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to generate PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadJPG = async () => {
        if (!selectedEvent) return;
        setShowExportOptions(false);

        try {
            setIsProcessing(true);
            toast.info("Capturing your admit card image...");

            const instLogoB64 = await toBase64(selectedEvent.institute_logo || '');
            const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

            const element = document.createElement('div');
            element.style.position = 'fixed';
            element.style.left = '-10000px';
            element.style.top = '0';
            element.style.width = '794px';
            element.style.backgroundColor = 'white';
            element.innerHTML = renderCardToString(selectedEvent, instLogoB64, photoB64);
            document.body.appendChild(element);

            await new Promise(r => setTimeout(r, 850));

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 794,
                height: 1123,
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            saveAs(imgData, `${selectedEvent.exam_name}_Admit_Card.jpg`);
            document.body.removeChild(element);

            toast.success('Identity Image Downloaded');
        } catch (error) {
            console.error('JPG Error:', error);
            toast.error('Failed to capture Image');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) return <div className="loader-box">Loading examinations...</div>;

    if (selectedEvent) {
        return (
            <div className="admit-card-container">
                <header className="page-header">
                    <div>
                        <button className="btn-secondary" onClick={() => setSelectedEvent(null)} style={{ marginBottom: '20px' }}>⇠ Back to Exams</button>
                        <h2>{selectedEvent.exam_name}</h2>
                    </div>
                    <button
                        className="btn-primary-gradient"
                        onClick={() => setShowExportOptions(true)}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : 'Export Card ✨'}
                    </button>
                </header>

                <div className="fadeIn" style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                    <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div
                            dangerouslySetInnerHTML={{
                                __html: renderCardToString(
                                    selectedEvent,
                                    getFullUrl(selectedEvent.institute_logo),
                                    getFullUrl(student.photo_url)
                                )
                            }}
                            style={{ background: 'white' }}
                        />
                    </div>
                </div>

                {isProcessing && (
                    <div className="id-global-overlay">
                        <div className="id-pulse-loader"></div>
                        <div className="progress-container-pro fadeIn">
                            <h3 style={{ margin: '0 0 10px' }}>Finalizing High-Res Identity Card</h3>
                            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Please wait while we render your official exam document...</p>
                        </div>
                    </div>
                )}

                {showExportOptions && (
                    <div className="export-modal-overlay" onClick={() => setShowExportOptions(false)}>
                        <div className="export-modal" onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', color: 'white' }}>Download Format</h2>
                            <p style={{ margin: '0 0 2.5rem', opacity: 0.6 }}>Choose how you'd like to save your admit card</p>

                            <div className="export-options">
                                <div className="export-option-card" onClick={handleDownloadJPG}>
                                    <div className="export-option-icon">🖼️</div>
                                    <div className="export-option-text">
                                        <div style={{ color: 'white' }}>Image File (JPG)</div>
                                        <div>High-quality picture for gallery</div>
                                    </div>
                                </div>
                                <div className="export-option-card" onClick={handleDownloadPDF}>
                                    <div className="export-option-icon">📄</div>
                                    <div className="export-option-text">
                                        <div style={{ color: 'white' }}>Document (PDF)</div>
                                        <div>Professional layout for printing</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="admit-card-container">
            <header className="page-header">
                <div>
                    <h2>Academic Admit Cards</h2>
                    <p>Official identification for your upcoming examinations</p>
                </div>
            </header>

            <div className="content-space">
                {events.length === 0 ? (
                    <div className="no-items-placeholder">
                        <div className="event-icon-box" style={{ margin: '0 auto 20px' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg>
                        </div>
                        <h3>No Active Exams</h3>
                        <p>Currently, there are no admit cards released for your class.</p>
                    </div>
                ) : (
                    <div className="events-grid">
                        {events.map(event => (
                            <div key={event.id} className="exam-event-card fadeIn" onClick={() => setSelectedEvent(event)}>
                                <div className="event-icon-box">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                </div>
                                <div className="event-title-stack">
                                    <h3>{event.exam_name}</h3>
                                    <p>Released on {formatDate(event.created_at)}</p>
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>AVAILABLE NOW</span>
                                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>View Card ➔</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAdmitCard;
