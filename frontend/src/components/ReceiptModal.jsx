import React, { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import ReceiptPDF from './ReceiptPDF';
import { saveAs } from 'file-saver';
import { BASE_URL } from '../config';
import './ReceiptModal.css';

const ReceiptModal = ({ isOpen, onClose, feeRecord, userData }) => {
    const [logoBase64, setLogoBase64] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    // Helper to get full logo URL
    const getLogoUrl = (url) => {
        if (!url) return '';
        if (typeof url !== 'string') return '';
        if (url.startsWith('http')) return url;
        return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // Smart data mapping
    const instName = userData?.institute_name || userData?.institute?.institute_name || feeRecord?.institute_name || userData?.name || '';
    const instLogoRaw = getLogoUrl(
        userData?.institute_logo ||
        userData?.logo_url ||
        userData?.logo ||
        userData?.institute?.logo_url ||
        userData?.profile?.logo_url ||
        feeRecord?.institute_logo ||
        feeRecord?.logo_url ||
        feeRecord?.logo
    );

    // Dynamic Base64 Conversion (CORS Workaround for PDF)
    useEffect(() => {
        let isMounted = true;
        if (isOpen && instLogoRaw && !instLogoRaw.startsWith('data:')) {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            // Add cache busting to force a fresh CORS check
            const cacheBuster = instLogoRaw.includes('?') ? '&' : '?';
            img.src = `${instLogoRaw}${cacheBuster}v=${Date.now()}`;

            img.onload = () => {
                if (!isMounted) return;
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png');
                    setLogoBase64(dataUrl);
                } catch (e) {
                    console.error('Logo conversion error:', e);
                    setLogoBase64(instLogoRaw);
                }
            };
            img.onerror = () => {
                if (!isMounted) return;
                console.error('Logo failed to load for conversion');
                setLogoBase64(instLogoRaw);
            };
        } else if (!isOpen) {
            setLogoBase64('');
        }
        return () => { isMounted = false; };
    }, [isOpen, instLogoRaw]);

    // Prevent background scrolling
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleDownloadPDF = async () => {
        if (!feeRecord || isDownloading) return;

        try {
            setIsDownloading(true);
            console.log('Generating PDF...');
            const instAddress = userData?.institute_address || userData?.address || userData?.institute?.address || feeRecord?.institute_address || feeRecord?.address || '';
            const instState = userData?.state || userData?.institute?.state || feeRecord?.state || '';
            const instDistrict = userData?.district || userData?.institute?.district || feeRecord?.district || '';
            const instPin = userData?.pin_code || userData?.pincode || userData?.institute?.pincode || feeRecord?.pin_code || feeRecord?.pincode || '';
            const instAff = userData?.affiliation || userData?.affiliation_code || userData?.institute?.affiliation || feeRecord?.affiliation || 'CBSE';

            const stName = feeRecord?.name || userData?.name || 'N/A';
            const stRoll = feeRecord?.roll_no || userData?.roll_no || 'N/A';
            const stClass = feeRecord?.class || userData?.class || 'N/A';
            const stSection = feeRecord?.section || userData?.section || 'N/A';

            const formattedDate = feeRecord.paid_at
                ? new Date(feeRecord.paid_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }) : 'N/A';

            const fullAddress = [instAddress, instDistrict, instState, instPin].filter(Boolean).join(' ');

            // Ensure we have a valid image source for react-pdf
            // We use the Base64 if available (best for CORS). 
            // If Base64 failed, we skip the logo in PDF to prevent a generation crash.
            const finalLogo = (logoBase64 && logoBase64.startsWith('data:')) ? logoBase64 : null;

            console.log('Generating PDF with props:', { instName, stName, hasLogo: !!finalLogo });

            const doc = (
                <ReceiptPDF
                    feeRecord={feeRecord}
                    userData={userData}
                    instName={instName}
                    instLogo={finalLogo}
                    instAff={instAff}
                    fullAddress={fullAddress}
                    stName={stName}
                    stRoll={stRoll}
                    stClass={stClass}
                    stSection={stSection}
                    formattedDate={formattedDate}
                />
            );

            console.log('Document object created, preparing blob...');
            const blob = await pdf(doc).toBlob();

            if (blob) {
                console.log('Blob created successfully, saving...');
                saveAs(blob, `Receipt_${feeRecord.payment_id || 'FEE'}.pdf`);
            } else {
                throw new Error('Failed to create PDF blob');
            }

        } catch (error) {
            console.error('CRITICAL PDF ERROR:', error);
            alert('Failed to generate PDF. You can still view the receipt on screen.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen || !feeRecord) return null;

    const instAddress = userData?.institute_address || userData?.address || userData?.institute?.address || feeRecord?.institute_address || feeRecord?.address || '';
    const instLandmark = userData?.landmark || userData?.institute?.landmark || feeRecord?.landmark || '';
    const instState = userData?.state || userData?.institute?.state || feeRecord?.state || '';
    const instDistrict = userData?.district || userData?.institute?.district || feeRecord?.district || '';
    const instPin = userData?.pin_code || userData?.pincode || userData?.institute?.pincode || feeRecord?.pin_code || feeRecord?.pincode || '';
    const instAff = userData?.affiliation || userData?.affiliation_code || userData?.institute?.affiliation || feeRecord?.affiliation || 'CBSE';

    const stName = feeRecord?.name || userData?.name || 'N/A';
    const stRoll = feeRecord?.roll_no || userData?.roll_no || 'N/A';
    const stClass = feeRecord?.class || userData?.class || 'N/A';
    const stSection = feeRecord?.section || userData?.section || 'N/A';

    const formattedDate = feeRecord.paid_at
        ? new Date(feeRecord.paid_at).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : 'N/A';

    const line1 = [instAddress, instLandmark].filter(Boolean).join(', ');
    const line2 = [instDistrict, instState, instPin].filter(Boolean).join(', ');

    return (
        <div className="receipt-overlay" onClick={onClose}>
            <div className="receipt-container" onClick={e => e.stopPropagation()}>
                <div className="watermark">PAID</div>

                <header className="receipt-header-new">
                    <div className="header-top-row">
                        <div className="receipt-logo">
                            {logoBase64 ? (
                                <img src={logoBase64} alt="Logo" />
                            ) : instLogoRaw ? (
                                <img src={instLogoRaw} alt="Logo" crossOrigin="anonymous" />
                            ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                                    <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" />
                                </svg>
                            )}
                        </div>
                        <div className="name-aff-container">
                            <h1 className="inst-name-receipt">{instName}</h1>
                            <div className="header-affiliation">{instAff}</div>
                        </div>
                    </div>

                    <div className="header-address-row">
                        <div>{line1}</div>
                        {line2 && <div>{line2}</div>}
                    </div>
                </header>

                <main className="receipt-body">
                    <div className={`receipt-status-badge ${feeRecord.payment_id?.startsWith('COUNTER_') ? 'counter-type' : ''}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feeRecord.payment_id?.startsWith('COUNTER_')
                            ? 'FEE PAID AT COUNTER'
                            : 'ONLINE FEE PAYMENT SUCCESSFUL'}
                    </div>

                    <span className="section-title">Student Particulars</span>
                    <div className="receipt-grid">
                        <div className="grid-item">
                            <label>Student Name</label>
                            <span>{stName}</span>
                        </div>
                        <div className="grid-item">
                            <label>Roll Number</label>
                            <span>{stRoll}</span>
                        </div>
                        <div className="grid-item">
                            <label>Class - Section</label>
                            <span>{stClass} - {stSection}</span>
                        </div>
                        <div className="grid-item">
                            <label>Payment Date</label>
                            <span>{formattedDate}</span>
                        </div>
                        <div className="grid-item">
                            <label>Collected By</label>
                            <span>{feeRecord.collected_by || (feeRecord.payment_id?.startsWith('COUNTER_') ? 'Staff' : 'Online System')}</span>
                        </div>
                    </div>

                    <span className="section-title">Fee Breakdown ({feeRecord.month_year})</span>
                    <table className="payment-table">
                        <thead>
                            <tr>
                                <th className="row-label">Description</th>
                                <th className="row-amt">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {feeRecord.breakdown && Object.entries(feeRecord.breakdown).map(([label, amount]) => (
                                <tr key={label}>
                                    <td className="row-label">{label}</td>
                                    <td className="row-amt">{parseFloat(amount).toLocaleString('en-IN')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="total-section">
                        <label>Grand Total</label>
                        <div className="total-amt">₹{parseFloat(feeRecord.total_amount || 0).toLocaleString('en-IN')}</div>
                    </div>
                </main>

                <footer className="receipt-footer">
                    <div className="receipt-action-btns">
                        <button className="download-btn-modern" onClick={handleDownloadPDF} disabled={isDownloading}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
                        </button>
                        <button className="done-btn" onClick={onClose}>Close Receipt</button>
                    </div>
                    <div className="tx-id" style={{ color: '#000000', fontWeight: 'bold' }}>TRANSACTION ID: {feeRecord.payment_id || 'RCV_123_TXN_PRM'}</div>
                    <p style={{ fontSize: '0.65rem', color: '#000000', marginTop: '1.5rem', fontWeight: 'bold' }}>
                        This is a computer generated receipt and does not require a physical signature.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default ReceiptModal;
