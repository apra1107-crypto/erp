import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config';
import './StudentFees.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ReceiptModal from '../components/ReceiptModal';

const StudentFees = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem('userData')));
    const [history, setHistory] = useState([]);
    const [arrears, setArrears] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // Get current month and year
    const currentDate = new Date();
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0-11
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const profileData = response.data.student;
                setUserData(profileData);
                localStorage.setItem('userData', JSON.stringify(profileData));
                // Fetch fees after we have the latest profile/ID
                fetchFeeHistory(profileData.id);
            } catch (error) {
                console.error('Fetch profile error:', error);
                // Fallback to local data if available
                if (userData?.id) fetchFeeHistory(userData.id);
            }
        };

        fetchProfileData();
    }, []);

    const fetchFeeHistory = async (studentId) => {
        const targetId = studentId || userData?.id;
        if (!targetId) return;

        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.FEES}/student/${targetId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data.history || []);
            setArrears(response.data.totalArrears || 0);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    // Extract available years from history
    const years = [...new Set(history.map(r => {
        const d = r.paid_at ? new Date(r.paid_at) : new Date(r.created_at || Date.now());
        return d.getFullYear().toString();
    }))].sort((a, b) => b - a);

    // Ensure current year is always an option
    if (!years.includes(new Date().getFullYear().toString())) {
        years.unshift(new Date().getFullYear().toString());
    }

    // Helper function to extract month and year from month_year string (e.g., "April 2026")
    const parseMonthYear = (monthYearStr) => {
        if (!monthYearStr) return { month: -1, year: '' };
        const parts = monthYearStr.split(' ');
        if (parts.length === 2) {
            const monthIndex = monthNames.indexOf(parts[0]);
            return { month: monthIndex, year: parts[1] };
        }
        return { month: -1, year: '' };
    };

    const pendingFees = history.filter(f => f.status === 'unpaid'); // Show ALL pending regardless of year? Usually yes, arrears are arrears.
    // Actually user said "show fees breakdown month wise success & requests", implying year filter applies to view.
    // But hiding pending fees from previous years is dangerous. 
    // Let's filter PAID history by year, but keep PENDING fees always visible (or filter them too if user explicit).
    // User: "first select year then show the fees breakdown". OK, I will filter both.

    const displayPending = pendingFees.filter(r => {
        const { month, year } = parseMonthYear(r.month_year);
        return year === selectedYear && month === selectedMonth;
    });

    const displayPaid = history.filter(f => {
        if (f.status !== 'paid') return false;
        const paidDate = new Date(f.paid_at);
        return paidDate.getFullYear().toString() === selectedYear &&
            paidDate.getMonth() === selectedMonth;
    });

    const handlePayment = async (feeRecord) => {
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const orderRes = await axios.post(`${API_ENDPOINTS.FEES}/create-order`, {
                amount: feeRecord.total_amount,
                studentFeeId: feeRecord.id,
                feeType: feeRecord.fee_type
            }, { headers: { Authorization: `Bearer ${token}` } });

            const { order, key_id } = orderRes.data;
            const options = {
                key: key_id,
                amount: order.amount,
                currency: "INR",
                name: "School ERP",
                description: `Fee Payment`,
                order_id: order.id,
                handler: async (response) => {
                    try {
                        await axios.post(`${API_ENDPOINTS.FEES}/verify-payment`, {
                            ...response,
                            studentFeeId: feeRecord.id,
                            instituteId: userData.institute_id,
                            feeType: feeRecord.fee_type,
                            studentId: userData.id,
                            month_year: feeRecord.month_year,
                            batch_id: feeRecord.batch_id
                        }, { headers: { Authorization: `Bearer ${token}` } });

                        toast.success('Payment successful!');
                        fetchFeeHistory();
                        // Auto-select the newly paid receipt
                        setSelectedReceipt({
                            ...feeRecord,
                            status: 'paid',
                            paid_at: new Date().toISOString(),
                            payment_id: response.razorpay_payment_id
                        });
                    } catch (err) { toast.error('Verification failed'); }
                },
                theme: { color: "#6366f1" }
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            toast.error('Payment failed to start');
        } finally {
            setIsProcessing(false);
        }
    };

    // Generic handleDownloadReceipt removed as it's now internal to ReceiptModal

    return (
        <div className="st-fees-page">
            <div className="st-page-header">
                {/* Back Button */}
                <button className="st-back-btn" onClick={() => navigate('/student-dashboard')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>

                <div className="st-filters-group">
                    {/* Month Selector */}
                    <div className="month-selector-container">
                        <label>Month</label>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="st-month-select">
                            {monthNames.map((month, index) => (
                                <option key={index} value={index}>{month}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selector */}
                    <div className="year-selector-container">
                        <label>Year</label>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="st-year-select">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Header Stats */}
            <div className="st-header-stats">
                <div className="st-stat-card">
                    <div className="stat-icon-wrapper">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
                    </div>
                    <div>
                        <div className="stat-label">Total Outstanding</div>
                        <div className="stat-value">₹{arrears.toLocaleString()}</div>
                    </div>
                    <div className={`stat-badge ${arrears > 0 ? 'pending' : 'clear'}`}>
                        {arrears > 0 ? 'Due' : 'Clear'}
                    </div>
                </div>
            </div>

            {/* Dual Columns Layout */}
            <div className="st-dual-grid">
                {/* Pending Fees Column */}
                <div className="st-panel">
                    <div className="st-panel-header">
                        <h3>Fee Requests - {monthNames[selectedMonth]} {selectedYear}</h3>
                        <span className="count-badge">{displayPending.length} Pending</span>
                    </div>
                    <div className="st-list-container">
                        {displayPending.length === 0 ? (
                            <div className="empty-state">
                                <span className="emoji">🎉</span>
                                <p>No pending dues for {monthNames[selectedMonth]} {selectedYear}!</p>
                            </div>
                        ) : (
                            displayPending.map(record => (
                                <div key={record.id} className="st-fee-row pending">
                                    <div className="fee-row-left">
                                        <div className="fee-icon-circle pending">!</div>
                                        <div className="fee-row-info">
                                            <span className="fee-row-title">{record.fee_type === 'occasional' ? (record.title_summary || 'Occasional Fee') : record.month_year}</span>
                                            <span className="fee-row-date">Due: {new Date().toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="fee-row-right">
                                        <span className="fee-amount">₹{record.total_amount}</span>
                                        <button className="pay-action-btn" onClick={() => handlePayment(record)} disabled={isProcessing}>
                                            {isProcessing ? '...' : 'Pay'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Paid History Column */}
                <div className="st-panel">
                    <div className="st-panel-header">
                        <h3>Payment History - {monthNames[selectedMonth]} {selectedYear}</h3>
                        <span className="count-badge success">{displayPaid.length} Paid</span>
                    </div>
                    <div className="st-list-container">
                        {displayPaid.length === 0 ? (
                            <div className="empty-state">
                                <span className="emoji">📂</span>
                                <p>No payment history for {monthNames[selectedMonth]} {selectedYear}.</p>
                            </div>
                        ) : (
                            displayPaid.map(record => (
                                <div key={record.id} className="st-fee-row paid" onClick={() => setSelectedReceipt(record)}>
                                    <div className="fee-row-left">
                                        <div className="fee-icon-circle success">✓</div>
                                        <div className="fee-row-info">
                                            <span className="fee-row-title">{record.fee_type === 'occasional' ? (record.title_summary || 'Occasional Fee') : record.month_year}</span>
                                            <span className="fee-row-date">Paid: {new Date(record.paid_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="fee-row-right">
                                        <span className="fee-amount success">₹{record.total_amount}</span>
                                        <button className="view-receipt-btn">
                                            Receipt
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Receipt Modal */}
            <ReceiptModal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                feeRecord={selectedReceipt}
                userData={userData}
            />
        </div>
    );
};

export default StudentFees;
