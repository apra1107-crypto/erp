import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS, BASE_URL } from '../config';
import FeeReceiptModal from '../components/FeeReceiptModal';
import { downloadReceiptPDF } from '../utils/receiptGenerator';
import './StudentFees.css';

const StudentFees = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [feeData, setFeeData] = useState(null);
    const [userData, setUserData] = useState(null);
    const [instituteData, setInstituteData] = useState(null);

    // Receipt Modal State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    // Custom Payment State
    const [showConfirmPayModal, setShowConfirmPayModal] = useState(false);
    const [paymentItem, setPaymentItem] = useState(null);
    const [customAmount, setCustomAmount] = useState('');

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyItem, setHistoryItem] = useState(null);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const blendingColors = [
        { name: 'red', gradient: 'linear-gradient(135deg, #FF5252 0%, #FF1744 100%)' },
        { name: 'orange', gradient: 'linear-gradient(135deg, #FF9100 0%, #FF6D00 100%)' },
        { name: 'pink', gradient: 'linear-gradient(135deg, #F06292 0%, #E91E63 100%)' },
        { name: 'blue', gradient: 'linear-gradient(135deg, #448AFF 0%, #2979FF 100%)' }
    ];

    const fetchFeesFull = useCallback(async () => {
        console.log("DEBUG: Attempting to fetch full fees data...");
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/fees-full`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("DEBUG: Full fees response:", response.data);
            setFeeData(response.data);
        } catch (error) {
            console.error('DEBUG: Error fetching full fees data:', error);
            toast.error('Failed to load fee information');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchInstituteInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            // We can get institute info from the profile endpoint
            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const s = response.data.student;
            setInstituteData({
                institute_name: s.institute_name,
                logo_url: s.institute_logo,
                address: s.institute_address,
                state: s.state,
                district: s.district,
                pincode: s.pincode,
                affiliation: s.affiliation
            });
        } catch (error) {
            console.error('Error fetching institute info:', error);
        }
    }, []);

    useEffect(() => {
        const storedData = localStorage.getItem('userData');
        console.log("DEBUG: User data from storage:", storedData);
        if (storedData) {
            setUserData(JSON.parse(storedData));
        }
        fetchFeesFull();
        fetchInstituteInfo();
    }, [fetchFeesFull, fetchInstituteInfo]);

    const openReceipt = (payment) => {
        let breakage = [];
        if (payment.type === 'MONTHLY') {
            const monthExtraCharges = (feeData?.extra_charges || []).filter(ec => ec.month === payment.month && ec.year === payment.year);
            breakage = [
                { label: 'Monthly Tuition Fee', amount: feeData.fee_structure.monthly_fees },
                ...(feeData.fee_structure.transport_facility ? [{ label: 'Transport Fee', amount: feeData.fee_structure.transport_fees }] : []),
                ...monthExtraCharges.map(ec => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
            ];
        } else {
            breakage = [{ label: payment.reason, amount: payment.due_amount }];
        }

        setReceiptData({
            institute: instituteData,
            student: userData,
            payment: {
                ...payment,
                paid_amount: payment.paid_amount,
                due_amount: payment.due_amount,
                transactions: payment.transactions
            },
            breakage: breakage,
            type: payment.type
        });
        setShowReceipt(true);
    };

    const handleDownloadReceipt = async (payment) => {
        let breakage = [];
        if (payment.type === 'MONTHLY') {
            const monthExtraCharges = (feeData?.extra_charges || []).filter(ec => ec.month === payment.month && ec.year === payment.year);
            breakage = [
                { label: 'Monthly Tuition Fee', amount: feeData.fee_structure.monthly_fees },
                ...(feeData.fee_structure.transport_facility ? [{ label: 'Transport Fee', amount: feeData.fee_structure.transport_fees }] : []),
                ...monthExtraCharges.map(ec => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
            ];
        } else {
            breakage = [{ label: payment.reason, amount: payment.due_amount }];
        }

        try {
            toast.info("Generating PDF receipt...");
            await downloadReceiptPDF({
                institute: instituteData,
                student: userData,
                payment: {
                    ...payment,
                    paid_amount: payment.paid_amount,
                    due_amount: payment.due_amount,
                    transactions: payment.transactions
                },
                breakage: breakage,
                type: payment.type,
                months: months
            });
            toast.success("Receipt downloaded successfully!");
        } catch (error) {
            console.error("PDF download error:", error);
            toast.error(`Download failed: ${error.message || 'Unknown error'}`);
        }
    };

    const handlePayNow = async (item, totalAmount) => {
        if (processing) return;
        setProcessing(true);

        try {
            const token = localStorage.getItem('token');
            // totalAmount is now passed from the card click
            
            // 1. Create Order
            const orderRes = await axios.post(`${BASE_URL}/api/razorpay/fees/create-order`, {
                amount: totalAmount,
                studentId: userData.id,
                month: item.month,
                year: item.year
            }, { headers: { Authorization: `Bearer ${token}` } });

            const orderData = orderRes.data;
            const order = orderData.order;

            // 2. Open Checkout
            const options = {
                key: orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_S895mUBuCSEpnW',
                amount: order.amount,
                currency: order.currency,
                name: "School ERP",
                description: `Monthly Fee - ${months[item.month - 1]} ${item.year}`,
                order_id: order.id,
                handler: async (response) => {
                    try {
                        // 3. Verify Payment
                        const verifyRes = await axios.post(`${BASE_URL}/api/razorpay/fees/verify-payment`, {
                            ...response,
                            studentId: userData.id,
                            month: item.month,
                            year: item.year,
                            amount: totalAmount
                        }, { headers: { Authorization: `Bearer ${token}` } });

                        if (verifyRes.data.success) {
                            toast.success('Payment successful!');
                            fetchFeesFull();
                        }
                    } catch (err) {
                        console.error('Verification Error:', err);
                        toast.error('Payment verification failed');
                    } finally {
                        setProcessing(false);
                    }
                },
                prefill: {
                    name: userData.name,
                    email: userData.email,
                    contact: userData.mobile
                },
                theme: { color: "#6366f1" },
                modal: { ondismiss: () => setProcessing(false) }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error('Payment Initialization Error:', error);
            toast.error('Failed to initialize payment');
            setProcessing(false);
        }
    };

    const handlePayOneTime = async (payment, finalAmount) => {
        if (processing) return;
        setProcessing(true);

        try {
            const token = localStorage.getItem('token');
            const amountToPay = parseFloat(finalAmount);

            // 1. Create Order
            const orderRes = await axios.post(`${BASE_URL}/api/razorpay/ot-fees/create-order`, {
                amount: amountToPay,
                studentId: userData.id,
                paymentId: payment.payment_id // ID from one_time_fee_payments
            }, { headers: { Authorization: `Bearer ${token}` } });

            const orderData = orderRes.data;
            const order = orderData.order;

            // 2. Open Checkout
            const options = {
                key: orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_S895mUBuCSEpnW',
                amount: order.amount,
                currency: order.currency,
                name: "School ERP",
                description: `One-Time Fee: ${payment.reason}`,
                order_id: order.id,
                handler: async (response) => {
                    try {
                        // 3. Verify Payment
                        const verifyRes = await axios.post(`${BASE_URL}/api/razorpay/ot-fees/verify-payment`, {
                            ...response,
                            studentId: userData.id,
                            paymentId: payment.payment_id,
                            amount: amountToPay
                        }, { headers: { Authorization: `Bearer ${token}` } });

                        if (verifyRes.data.success) {
                            toast.success('One-time fee paid successfully!');
                            setShowConfirmPayModal(false);
                            fetchFeesFull();
                        }
                    } catch (err) {
                        console.error('OT Verification Error:', err);
                        toast.error('Payment verification failed');
                    } finally {
                        setProcessing(false);
                    }
                },
                prefill: {
                    name: userData.name,
                    email: userData.email,
                    contact: userData.mobile
                },
                theme: { color: "#ec4899" },
                modal: { ondismiss: () => setProcessing(false) }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error('OT Payment Initialization Error:', error);
            toast.error('Failed to initialize payment');
            setProcessing(false);
        }
    };

    const isPaid = (month, year) => {
        const paid = feeData?.payments?.some(p => p.month === month && p.year === year && p.status === 'paid');
        return paid;
    };

    if (loading) {
        return (
            <div className="loading-center">
                <div className="fees-spinner"></div>
                <p>Loading your financial records...</p>
            </div>
        );
    }

    const pendingMonthly = feeData?.activated_months?.filter(m => !isPaid(m?.month, m?.year)) || [];
    const pendingOneTime = feeData?.one_time_fees?.filter(f => f?.status !== 'paid') || [];
    const totalPendingCount = (pendingMonthly?.length || 0) + (pendingOneTime?.length || 0);

    return (
        <div className="student-fees-page animate-fade-in">
            <header className="s-fees-header-modern">
                <div className="header-left">
                    <button className="s-back-btn-minimal" onClick={() => navigate('/student-dashboard')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <h1 className="header-title-text">Financial Portal</h1>
                    <span style={{color: 'gray', fontSize: '10px', marginLeft: '10px'}}>
                        ({totalPendingCount} Pending | {feeData?.payments?.length || 0} History)
                    </span>
                </div>
                <div className="header-right">
                    {feeData?.fee_structure && (
                        <div className="quick-summary-badge">
                            <span>Monthly Payable</span>
                            <strong>₹{(
                                (feeData.fee_structure.monthly_fees || 0) + 
                                (feeData.fee_structure.transport_facility ? (feeData.fee_structure.transport_fees || 0) : 0) +
                                (feeData.extra_charges || [])
                                    .filter(ec => ec.month === (new Date().getMonth() + 1) && ec.year === new Date().getFullYear())
                                    .reduce((sum, ec) => sum + parseFloat(ec.amount), 0)
                            ).toLocaleString()}</strong>
                        </div>
                    )}
                </div>
            </header>

            <div className="s-portal-container">
                <div className="s-fees-main-layout">
                    {/* LEFT SIDE: PENDING DUES */}
                    <div className="s-fees-left">
                        <h3 className="section-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3a5 5 0 0 0 5-5 5 5 0 0 0-5-5"/></svg>
                            Pending Dues
                        </h3>
                        <div className="pending-grid">
                            {totalPendingCount === 0 ? (
                                <div className="all-clear-card">
                                    <div className="clear-icon">🎉</div>
                                    <h4>No Pending Dues!</h4>
                                    <p>You're all caught up with your monthly and one-time payments.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Monthly Fee Cards */}
                                    {pendingMonthly.map((item, index) => {
                                        const monthly = feeData.fee_structure?.monthly_fees || 0;
                                        const transport = feeData.fee_structure?.transport_facility ? (feeData.fee_structure?.transport_fees || 0) : 0;
                                        const monthExtraCharges = (feeData.extra_charges || []).filter(ec => ec.month === item.month && ec.year === item.year);
                                        const extraTotal = monthExtraCharges.reduce((sum, ec) => sum + parseFloat(ec.amount), 0);
                                        const total = monthly + transport + extraTotal;
                                        const color = blendingColors[index % blendingColors.length];
                                        
                                        return (
                                            <div key={`m-${item.month}-${item.year}`} className="fee-flashcard" style={{ background: color.gradient }}>
                                                <div className="card-top">
                                                    <div className="month-year">
                                                        <h2>{months[(item.month || 1) - 1]}</h2>
                                                        <span>{item.year} - Monthly</span>
                                                    </div>
                                                    <div className="card-icon">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h.01M11 15h.01"/></svg>
                                                    </div>
                                                </div>

                                                <div className="card-breakage-area">
                                                    <div className="breakage-row"><span>Tution Fee</span><strong>₹{monthly.toLocaleString()}</strong></div>
                                                    {feeData.fee_structure?.transport_facility && (
                                                        <div className="breakage-row"><span>Transport</span><strong>₹{transport.toLocaleString()}</strong></div>
                                                    )}
                                                    {monthExtraCharges.map((ec, i) => (
                                                        <div key={i} className="breakage-row">
                                                            <span>{ec.reason}</span>
                                                            <strong>₹{parseFloat(ec.amount).toLocaleString()}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="card-bottom">
                                                    <div className="amount-stack">
                                                        <label>TOTAL PAYABLE</label>
                                                        <div className="amount">₹{total.toLocaleString()}</div>
                                                    </div>
                                                    <button className="pay-now-btn" onClick={() => handlePayNow(item, total)} disabled={processing}>
                                                        {processing ? '...' : 'Pay Now'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* One-Time Fee Cards */}
                                    {pendingOneTime.map((item, index) => {
                                        const color = blendingColors[(index + pendingMonthly.length) % blendingColors.length];
                                        const due = parseFloat(item.due_amount || 0);
                                        const original = parseFloat(item.original_amount || 0);
                                        const paid = parseFloat(item.paid_amount || 0);
                                        const remaining = due - paid;
                                        const isOverridden = Math.abs(due - original) > 0.01;
                                        
                                        return (
                                            <div key={`ot-${item.payment_id}`} className="fee-flashcard" style={{ background: color.gradient }}>
                                                <div className="card-top">
                                                    <div className="month-year">
                                                        <h2>{item.reason}</h2>
                                                        <span>One-Time Fee Request</span>
                                                    </div>
                                                    <div className="card-icon">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
                                                        {paid > 0 && (
                                                            <button 
                                                                className="s-history-trigger" 
                                                                onClick={(e) => { e.stopPropagation(); setHistoryItem(item); setShowHistoryModal(true); }}
                                                                title="View Payment History"
                                                            >ⓘ</button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="s-price-override-info">
                                                    {isOverridden && (
                                                        <div className="s-override-badge">
                                                            <span className="s-old-pr">₹{original.toLocaleString()}</span>
                                                            <span className="s-arr">→</span>
                                                            <span className="s-new-pr">₹{due.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="card-breakage-area">
                                                    <div className="breakage-row main-label-s">
                                                        <span>DESCRIPTION</span>
                                                        <span>AMOUNT</span>
                                                    </div>
                                                    {item.breakdown && Array.isArray(item.breakdown) ? (
                                                        item.breakdown.map((r, i) => (
                                                            <div key={i} className="breakage-row">
                                                                <span>{r.reason}</span>
                                                                <strong>₹{parseFloat(r.amount).toLocaleString()}</strong>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="breakage-row">
                                                            <span>Total Amount</span>
                                                            <strong>₹{due.toLocaleString()}</strong>
                                                        </div>
                                                    )}
                                                    {paid > 0 && (
                                                        <div className="breakage-row paid-row-s">
                                                            <span>Paid So Far</span>
                                                            <strong>- ₹{paid.toLocaleString()}</strong>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="card-bottom">
                                                    <div className="amount-stack">
                                                        <label>{paid > 0 ? 'REMAINING BALANCE' : 'TOTAL PAYABLE'}</label>
                                                        <div className="amount">₹{remaining.toLocaleString()}</div>
                                                    </div>
                                                    <button className="pay-now-btn" onClick={() => { 
                                                        setPaymentItem({ ...item, type: 'ONE-TIME', remaining }); 
                                                        setCustomAmount(remaining); 
                                                        setShowConfirmPayModal(true); 
                                                    }} disabled={processing}>
                                                        {processing ? '...' : paid > 0 ? 'Pay Balance' : 'Pay Now'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: HISTORY */}
                    <div className="s-fees-right">
                        <h3 className="section-label">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: '10px'}}><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
                            Payment History
                        </h3>
                        <div className="history-container-pro">
                            {(!feeData?.payments || feeData.payments.length === 0) && (!feeData?.one_time_fees || feeData.one_time_fees.filter(f => f.status === 'paid').length === 0) ? (
                                <div className="empty-history-pro">
                                    <p>No payment records found yet.</p>
                                </div>
                            ) : (
                                <>
                                    {[
                                        ...(feeData?.payments || []).map(p => ({ ...p, type: 'MONTHLY' })),
                                        ...(feeData?.one_time_fees || []).filter(f => f?.status === 'paid').map(f => ({ ...f, type: 'ONE-TIME', month: f.month, year: f.year, paid_at: f.paid_at }))
                                    ].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at)).map((payment, index) => {
                                        const monthlyAmt = feeData?.fee_structure?.monthly_fees || 0;
                                        const transportAmt = feeData?.fee_structure?.transport_facility ? (feeData?.fee_structure?.transport_fees || 0) : 0;
                                        const monthExtraCharges = (feeData?.extra_charges || []).filter(ec => ec.month === payment.month && ec.year === payment.year);
                                        const extraTotal = monthExtraCharges.reduce((sum, ec) => sum + parseFloat(ec.amount), 0);
                                        
                                        const total = payment.type === 'MONTHLY' 
                                            ? (monthlyAmt + transportAmt + extraTotal)
                                            : parseFloat(payment.paid_amount || 0);

                                        return (
                                            <div key={index} className="history-item-pro-expanded">
                                                <div className="h-top-row">
                                                    <div className="h-left">
                                                        <div className={`h-icon-box ${payment.type === 'ONE-TIME' ? 'ot-icon' : ''}`}>
                                                            {payment.type === 'MONTHLY' ? (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                            ) : (
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
                                                            )}
                                                        </div>
                                                        <div className="h-text">
                                                            <h4>{payment.type === 'ONE-TIME' ? payment.reason : `${months[(payment.month || 1) - 1]} ${payment.year}`}</h4>
                                                            <span>Paid on {new Date(payment.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        </div>
                                                    </div>
                                                    <div className="h-right">
                                                        <div className="h-amount-row">
                                                            <div className="h-amount">₹{total.toLocaleString()}</div>
                                                            <div className="h-receipt-btns">
                                                                <button className="h-view-receipt-btn" onClick={() => openReceipt(payment)} title="View Receipt">
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                                </button>
                                                                <button className="h-download-receipt-btn" onClick={() => handleDownloadReceipt(payment)} title="Download PDF">
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <span className="h-status-tag">SUCCESS</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="h-breakage-details">
                                                    {payment.type === 'MONTHLY' ? (
                                                        <>
                                                            <div className="hb-row"><span>Monthly Tution Fee</span><span>₹{monthlyAmt.toLocaleString()}</span></div>
                                                            {feeData.fee_structure?.transport_facility && (
                                                                <div className="hb-row"><span>Transport Service</span><span>₹{transportAmt.toLocaleString()}</span></div>
                                                            )}
                                                            {monthExtraCharges.map((ec, i) => (
                                                                <div key={i} className="hb-row"><span>{ec.reason}</span><span>₹{parseFloat(ec.amount).toLocaleString()}</span></div>
                                                            ))}
                                                        </>
                                                    ) : (
                                                        <div className="hb-row"><span>{payment.reason}</span><span>₹{parseFloat(payment.paid_amount).toLocaleString()}</span></div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showConfirmPayModal && paymentItem && (
                <div className="fee-modal-overlay">
                    <div className="s-confirm-pay-modal">
                        <div className="s-modal-top">
                            <h3>Confirm Payment</h3>
                            <button className="close-btn" onClick={() => setShowConfirmPayModal(false)}>×</button>
                        </div>
                        <div className="s-modal-mid">
                            <p>Paying for: <strong>{paymentItem.reason}</strong></p>
                            <div className="s-pay-summary">
                                <div className="s-pay-row"><span>Total Due:</span> <strong>₹{parseFloat(paymentItem.due_amount).toLocaleString()}</strong></div>
                                <div className="s-pay-row"><span>Already Paid:</span> <strong>₹{parseFloat(paymentItem.paid_amount || 0).toLocaleString()}</strong></div>
                                <div className="s-pay-row s-balance"><span>Remaining Balance:</span> <strong>₹{parseFloat(paymentItem.remaining).toLocaleString()}</strong></div>
                            </div>

                            <div className="s-amount-input-area">
                                <label>Enter Amount to Pay (₹)</label>
                                <input 
                                    type="number" 
                                    value={customAmount} 
                                    onChange={e => setCustomAmount(e.target.value)} 
                                    placeholder="Enter amount"
                                />
                                <div className="s-quick-options">
                                    <button onClick={() => setCustomAmount(paymentItem.remaining)}>Pay Full Balance</button>
                                </div>
                            </div>
                        </div>
                        <div className="s-modal-bot">
                            <button className="s-cancel-btn" onClick={() => setShowConfirmPayModal(false)}>Cancel</button>
                            <button 
                                className="s-confirm-btn" 
                                disabled={processing || !customAmount || parseFloat(customAmount) <= 0 || parseFloat(customAmount) > paymentItem.remaining}
                                onClick={() => handlePayOneTime(paymentItem, customAmount)}
                            >
                                {processing ? 'Initializing...' : `Pay ₹${parseFloat(customAmount || 0).toLocaleString()} Now`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHistoryModal && historyItem && (
                <div className="fee-modal-overlay">
                    <div className="s-confirm-pay-modal history-modal-s">
                        <div className="s-modal-top">
                            <h3>Payment History</h3>
                            <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
                        </div>
                        <div className="s-modal-mid">
                            <p>Fee Reason: <strong>{historyItem.reason}</strong></p>
                            
                            <div className="s-history-breakdown-box">
                                <div className="s-h-row"><span>Initial Amount:</span> <strong>₹{parseFloat(historyItem.original_amount).toLocaleString()}</strong></div>
                                {Math.abs(parseFloat(historyItem.due_amount) - parseFloat(historyItem.original_amount)) > 0.01 && (
                                    <div className="s-h-row overridden"><span>Adjusted Amount:</span> <strong>₹{parseFloat(historyItem.due_amount).toLocaleString()}</strong></div>
                                )}
                                <div className="s-h-row total"><span>Paid So Far:</span> <strong>₹{parseFloat(historyItem.paid_amount).toLocaleString()}</strong></div>
                                <div className="s-h-row balance"><span>Remaining:</span> <strong>₹{(parseFloat(historyItem.due_amount) - parseFloat(historyItem.paid_amount)).toLocaleString()}</strong></div>
                            </div>

                            <div className="s-transactions-timeline">
                                <label>TRANSACTION LOG</label>
                                {historyItem.transactions && historyItem.transactions.length > 0 ? (
                                    <div className="s-t-list">
                                        {historyItem.transactions.map((t, i) => (
                                            <div key={i} className="s-t-item">
                                                <div className="s-t-meta">
                                                    <span>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                                    <small>{new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                                                </div>
                                                <div className="s-t-info">
                                                    <span className="s-t-method">{t.payment_method}</span>
                                                </div>
                                                <div className="s-t-amount">₹{parseFloat(t.amount).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="no-t">No payments recorded.</p>}
                            </div>
                        </div>
                        <div className="s-modal-bot">
                            <button className="s-confirm-btn" onClick={() => setShowHistoryModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {showReceipt && receiptData && (
                <FeeReceiptModal 
                    isOpen={showReceipt} 
                    onClose={() => setShowReceipt(false)} 
                    data={receiptData} 
                />
            )}
        </div>
    );
};

export default StudentFees;