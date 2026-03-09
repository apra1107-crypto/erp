import React from 'react';
import './FeeReceiptModal.css';

const FeeReceiptModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const { 
        institute, 
        student, 
        payment, 
        breakage, 
        type // 'MONTHLY' or 'ONE-TIME'
    } = data;

    const paidDate = new Date(payment.paid_at);
    const dayName = paidDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedDate = paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = paidDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className="receipt-modal-overlay" onClick={onClose}>
            <div className="receipt-modal-card" onClick={e => e.stopPropagation()}>
                <div className="receipt-actions">
                    <button className="close-btn-modern" onClick={onClose} title="Close Preview">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="receipt-content">
                    {/* Watermark */}
                    <div className="paid-watermark">PAID</div>

                    {/* Centered Professional Header */}
                    <header className="receipt-header-centered">
                        <div className="header-main-row">
                            {institute.logo_url && <img src={institute.logo_url} alt="Logo" className="receipt-logo-centered" />}
                            <h1 className="inst-name-centered">{institute.institute_name}</h1>
                        </div>
                        {institute.affiliation && <p className="inst-aff-centered">{institute.affiliation}</p>}
                        <div className="inst-address-centered">
                            <p>{institute.address}{institute.landmark ? `, ${institute.landmark}` : ''}, {institute.district}, {institute.state} - {institute.pincode}</p>
                        </div>
                    </header>

                    <div className="receipt-title-simple">
                        <h2>FEE RECEIPT</h2>
                    </div>

                    {/* Details Sections */}
                    <div className="receipt-details-container">
                        {type === 'MONTHLY' && (
                            <div className="detail-section-full">
                                <label>PAYMENT DETAILS</label>
                                <div className="details-row-flex">
                                    <p>Billing Month: <strong>{months[(payment.month || 1) - 1]} {payment.year}</strong></p>
                                    <p>Payment Date: <strong>{formattedDate}</strong></p>
                                    <p>Day: <strong>{dayName}</strong></p>
                                    <p>Time: <strong>{formattedTime}</strong></p>
                                    <p>Collected By: <strong>{payment.collected_by || 'Staff'}</strong></p>
                                </div>
                            </div>
                        )}

                        <div className="detail-section-full">
                            <label>STUDENT DETAILS</label>
                            <div className="details-row-flex">
                                <p>Name: <strong>{student.name}</strong></p>
                                <p>Class: <strong>{student.class}-{student.section}</strong></p>
                                <p>Roll No: <strong>{student.roll_no}</strong></p>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="receipt-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th className="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {breakage.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.reason || item.label}</td>
                                    <td className="text-right">₹{parseFloat(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th>TOTAL PAYABLE</th>
                                <th className="text-right total-amt">₹{breakage.reduce((sum, item) => sum + parseFloat(item.amount), 0).toLocaleString()}</th>
                            </tr>
                        </tfoot>
                    </table>

                    {/* --- Transaction History for One-Time Fees --- */}
                    {type === 'ONE-TIME' && payment.transactions && payment.transactions.length > 0 && (
                        <div className="receipt-transactions-history">
                            <label className="history-label">PAYMENT BREAKDOWN (TRANSACTIONS)</label>
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date & Day</th>
                                        <th>Time</th>
                                        <th>Method</th>
                                        <th className="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payment.transactions.map((t, idx) => {
                                        const tDate = new Date(t.created_at);
                                        return (
                                            <tr key={idx}>
                                                <td>
                                                    <div className="t-date-stack">
                                                        <span>{tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                        <small>{tDate.toLocaleDateString('en-IN', { weekday: 'long' })}</small>
                                                    </div>
                                                </td>
                                                <td>{tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                                <td>{t.payment_method}</td>
                                                <td className="text-right">₹{parseFloat(t.amount).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan="3">TOTAL COLLECTED</th>
                                        <th className="text-right">₹{payment.transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0).toLocaleString()}</th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="receipt-footer">
                        {type === 'MONTHLY' ? (
                            <div className="payment-meta">
                                <p>Payment Method: <strong>{payment.payment_method === 'Cash' ? 'Cash' : `Online (${payment.payment_method})`}</strong></p>
                                {payment.transaction_id && <p>Transaction ID: <code className="tx-id">{payment.transaction_id}</code></p>}
                            </div>
                        ) : (
                            <div style={{ flex: 1 }}></div>
                        )}
                        <div className="footer-note">
                            <p>This is a computer-generated receipt.</p>
                            <p>Thank you for your payment!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeReceiptModal;