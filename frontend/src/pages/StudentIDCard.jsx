import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { BASE_URL } from '../config';
import './IDCardView.css';

const StudentIDCard = () => {
    const rawData = localStorage.getItem('userData');
    const student = rawData ? JSON.parse(rawData) : null;

    const [isProcessing, setIsProcessing] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);

    const toBase64 = (url) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
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

    const renderCardToString = (instLogoB64, photoB64) => {
        const instName = student?.institute_name || "INSTITUTE NAME";
        const instAddr = student?.institute_address || student?.address || "";
        const instDistrict = student?.district || "";
        const instPincode = student?.pincode || "";

        return `
            <div style="width: 360px; min-height: 180px; background: #ffffff !important; border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-family: Arial, sans-serif; color: #000;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 5px 12px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ${instLogoB64 ? `<img src="${instLogoB64}" style="width: 25px; height: 25px; object-fit: contain;">` : `<div style="font-size: 14px; font-weight: 900; color: white;">${instName.charAt(0)}</div>`}
                    <h2 style="margin: 0; font-size: 11px; font-weight: 900; color: white; text-transform: uppercase;">${instName}</h2>
                </div>
                <div style="background: #ffffff; padding: 5px 10px; text-align: center; color: #000; font-size: 7.2px; font-weight: 800; border-bottom: 1.2px solid #e2e8f0; letter-spacing: 0.1px;">
                    ${instAddr}, ${instDistrict} - ${instPincode}
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
                            ${photoB64 ? `<img src="${photoB64}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #ccc;">👤</div>`}
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
    };

    const handleDownloadPDF = async () => {
        setShowExportOptions(false);
        try {
            setIsProcessing(true);
            const pdf = new jsPDF('l', 'mm', [130, 85]); // Landscape card size
            toast.info("Preparing your ID Card PDF...");

            const instLogoB64 = await toBase64(student.institute_logo || student.logo_url);
            const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

            const element = document.createElement('div');
            element.style.position = 'fixed';
            element.style.left = '-10000px';
            element.style.top = '0';
            element.style.width = '360px';
            element.style.backgroundColor = 'white';
            element.innerHTML = renderCardToString(instLogoB64, photoB64);
            document.body.appendChild(element);

            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            pdf.addImage(imgData, 'JPEG', 0, 0, 130, 85);
            document.body.removeChild(element);

            pdf.save(`${student.name}_ID_Card.pdf`);
            toast.success('PDF Downloaded');
        } catch (error) {
            console.error(error);
            toast.error('Failed to generate PDF');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadJPG = async () => {
        setShowExportOptions(false);
        try {
            setIsProcessing(true);
            toast.info("Capturing your ID Card image...");

            const instLogoB64 = await toBase64(student.institute_logo || student.logo_url);
            const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;

            const element = document.createElement('div');
            element.style.position = 'fixed';
            element.style.left = '-10000px';
            element.style.top = '0';
            element.style.width = '360px';
            element.style.backgroundColor = 'white';
            element.innerHTML = renderCardToString(instLogoB64, photoB64);
            document.body.appendChild(element);

            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            saveAs(imgData, `${student.name}_ID_Card.jpg`);
            document.body.removeChild(element);

            toast.success('Image Downloaded');
        } catch (error) {
            console.error(error);
            toast.error('Failed to capture Image');
        } finally {
            setIsProcessing(false);
        }
    };

    if (!student) return <div className="loader-box">Loading...</div>;

    return (
        <div className="id-card-view-container">
            <header className="page-header">
                <div>
                    <h2>My Identity Card</h2>
                    <p>Official identification credential for the current academic session</p>
                </div>
                <button
                    className="btn-primary-gradient"
                    onClick={() => setShowExportOptions(true)}
                    disabled={isProcessing}
                >
                    {isProcessing ? 'Processing...' : 'Export ID Card ✨'}
                </button>
            </header>

            <div className="id-preview-stage" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem' }}>
                <div style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.12)', borderRadius: '12px' }}>
                    <div className="printable-card" style={{
                        width: '360px',
                        minHeight: '180px',
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
                        fontFamily: 'Arial, sans-serif',
                        color: '#000'
                    }}>
                        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            {student.institute_logo ? <img src={student.institute_logo} style={{ width: '25px', height: '25px', objectFit: 'contain' }} /> : <div style={{ fontSize: '14px', fontWeight: '900', color: 'white' }}>{student.institute_name?.charAt(0)}</div>}
                            <h2 style={{ margin: '0', fontSize: '11px', fontWeight: '900', color: 'white', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{student.institute_name}</h2>
                        </div>
                        <div style={{ background: '#ffffff', padding: '4px 10px', textAlign: 'center', color: '#000', fontSize: '7.2px', fontWeight: '800', borderBottom: '1.2px solid #e2e8f0', letterSpacing: '0.1px' }}>
                            {student.institute_address || student.address}, {student.district} - {student.pincode}
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
                </div>
            </div>

            {
                isProcessing && (
                    <div className="id-global-overlay">
                        <div className="id-pulse-loader"></div>
                        <div className="progress-container-pro fadeIn">
                            <h3 style={{ margin: '0 0 10px' }}>Finalizing High-Res ID Card</h3>
                            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Please wait while we render your official identification document...</p>
                        </div>
                    </div>
                )
            }

            {
                showExportOptions && (
                    <div className="export-modal-overlay" onClick={() => setShowExportOptions(false)}>
                        <div className="export-modal" onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', color: 'white' }}>Download Format</h2>
                            <p style={{ margin: '0 0 2.5rem', opacity: 0.6 }}>Choose how you'd like to save your identity card</p>

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
                )
            }
        </div>
    );
};

export default StudentIDCard;
