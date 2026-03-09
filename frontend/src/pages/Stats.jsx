import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import { toast } from 'react-toastify';
import './Stats.css';

const Stats = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Auth & Permission Logic
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userType = localStorage.getItem('userType');
    const hasRevenueAccess = userType === 'principal' || (userType === 'teacher' && userData.special_permission);

    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'students');
    const [loading, setLoading] = useState(true);
    const [statsData, setStatsData] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // Force redirect if no access to revenue
    useEffect(() => {
        if (activeTab === 'revenue' && !hasRevenueAccess) {
            setActiveTab('students');
        }
    }, [activeTab, hasRevenueAccess]);

    // Update active tab if it changes in state (e.g. via navigation)
    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalTab, setModalTab] = useState('present'); // 'present' | 'absent'
    const [selectedSection, setSelectedSection] = useState(null);
    const [sectionStudents, setSectionStudents] = useState([]);

    // Revenue Detail Modal State
    const [showRevenueModal, setShowRevenueModal] = useState(false);
    const [revenueType, setRevenueType] = useState('monthly'); // 'monthly' | 'onetime'
    const [revenueDate, setRevenueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyRevenueData, setDailyRevenueData] = useState([]);
    const [revenueLoading, setRevenueLoading] = useState(false);

    useEffect(() => {
        fetchStats();
    }, [selectedDate]);

    useEffect(() => {
        if (showRevenueModal) {
            fetchDailyRevenue();
        }
    }, [revenueDate, revenueType, showRevenueModal]);

    const fetchDailyRevenue = async () => {
        setRevenueLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/daily-revenue-details`, {
                params: { date: revenueDate, type: revenueType },
                headers: { Authorization: `Bearer ${token}` }
            });
            setDailyRevenueData(response.data || []);
        } catch (error) {
            console.error('Error fetching revenue details:', error);
            toast.error('Failed to load revenue details');
        } finally {
            setRevenueLoading(false);
        }
    };

    const handleRevenueClick = (type) => {
        setRevenueType(type);
        setRevenueDate(new Date().toISOString().split('T')[0]); // Default to today
        setShowRevenueModal(true);
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/stats`, {
                params: { date: selectedDate },
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatsData(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
            toast.error('Failed to load institute statistics');
        } finally {
            setLoading(false);
        }
    };

    const handleSectionClick = async (className, section) => {
        setSelectedSection({ className, section });
        setShowModal(true);
        setModalLoading(true);
        setModalTab('present');
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/attendance-list-detail`, {
                params: { className, section, date: selectedDate },
                headers: { Authorization: `Bearer ${token}` }
            });
            setSectionStudents(response.data || []);
        } catch (error) {
            toast.error("Failed to fetch student details");
        } finally {
            setModalLoading(false);
        }
    };

    if (loading && !statsData) {
        return (
            <div className="stats-page-container">
                <div className="loading-spinner">Loading statistics...</div>
            </div>
        );
    }

    const groupedAttendance = statsData?.attendance?.today?.byClassSection?.reduce((acc, curr) => {
        if (!acc[curr.class]) acc[curr.class] = [];
        acc[curr.class].push(curr);
        return acc;
    }, {}) || {};

    const filteredStudents = sectionStudents.filter(s => s.status === modalTab);

    const renderStudentsTab = () => (
        <div className="stats-content-area">
            <div className="summary-grid">
                <div className="summary-item blue">
                    <span className="summary-label">Total Enrollment</span>
                    <span className="summary-value">{statsData?.students?.total || 0}</span>
                </div>
                <div className="summary-item green">
                    <span className="summary-label">Present Today</span>
                    <span className="summary-value">
                        {statsData?.attendance?.today?.students?.find(s => s.status === 'present')?.count || 0}
                    </span>
                </div>
                <div className="summary-item orange">
                    <span className="summary-label">Absent Today</span>
                    <span className="summary-value">
                        {statsData?.attendance?.today?.students?.find(s => s.status === 'absent')?.count || 0}
                    </span>
                </div>
            </div>

            <div className="attendance-summary-card">
                <div className="stats-card-header">
                    <h3>Class-wise Attendance Detail</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click on a section to view student list</p>
                </div>

                <div className="stats-table-container">
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th className="class-cell-v2">CLASS</th>
                                <th>SECTIONS (PRESENT / TOTAL)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(groupedAttendance).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([className, sections]) => (
                                <tr key={className}>
                                    <td className="class-cell-v2">
                                        <span className="class-name-v2">{className}</span>
                                    </td>
                                    <td style={{ padding: 0 }}>
                                        <div className="sections-grid-v2">
                                            {sections.sort((a, b) => a.section.localeCompare(b.section)).map((sec, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="section-cell-v2"
                                                    onClick={() => handleSectionClick(sec.class, sec.section)}
                                                >
                                                    <span className="section-letter-v2">{sec.section}</span>
                                                    <span className="section-ratio-v2">
                                                        {sec.present_students}<span>/{sec.total_students}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderTeachersTab = () => (
        <div className="stats-content-area">
            <div className="summary-grid">
                <div className="summary-item purple">
                    <span className="summary-label">Total Teachers</span>
                    <span className="summary-value">{statsData?.teachers?.total || 0}</span>
                </div>
                <div className="summary-item green">
                    <span className="summary-label">Present Today</span>
                    <span className="summary-value">
                        {statsData?.attendance?.today?.teachers?.find?.(t => t.status === 'present')?.count || 0}
                    </span>
                </div>
                <div className="summary-item orange">
                    <span className="summary-label">Absent Today</span>
                    <span className="summary-value">
                        {statsData?.attendance?.today?.teachers?.find?.(t => t.status === 'absent')?.count || 0}
                    </span>
                </div>
            </div>

            <div className="attendance-summary-card">
                <div className="stats-card-header">
                    <h3>Teacher Attendance Report</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Daily presence status of institute teachers</p>
                </div>

                <div className="teacher-list" style={{ padding: '1rem 2.5rem 2.5rem 2.5rem' }}>
                    {statsData?.attendance?.today?.teacherList?.length > 0 ? (
                        statsData.attendance.today.teacherList.map(teacher => (
                            <div key={teacher.id} className="teacher-item">
                                {teacher.photo_url ? (
                                    <img src={teacher.photo_url} alt="" className="teacher-photo" />
                                ) : (
                                    <div className="teacher-placeholder-photo">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </div>
                                )}
                                <div className="teacher-info">
                                    <h4>{teacher.name}</h4>
                                    <p>{teacher.subject}</p>
                                </div>
                                <div className={`status-badge-v2 ${teacher.status}`}>
                                    {teacher.status}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-list-msg">No staff records found for this date.</div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderRevenueTab = () => {
        const monthly = statsData?.revenue?.monthly || { expected: 0, collected: 0 };
        const oneTime = statsData?.revenue?.oneTime || { expected: 0, collected: 0 };
        const totalExpected = monthly.expected + oneTime.expected;
        const totalCollected = monthly.collected + oneTime.collected;

        return (
            <div className="stats-content-area">
                <div className="summary-grid">
                    <div className="summary-item blue">
                        <span className="summary-label">Expected Total</span>
                        <span className="summary-value">₹{totalExpected.toLocaleString()}</span>
                    </div>
                    <div className="summary-item green">
                        <span className="summary-label">Collected Total</span>
                        <span className="summary-value">₹{totalCollected.toLocaleString()}</span>
                    </div>
                    <div className="summary-item purple">
                        <span className="summary-label">Pending</span>
                        <span className="summary-value">₹{(totalExpected - totalCollected).toLocaleString()}</span>
                    </div>
                </div>

                <div style={{ marginTop: '3rem' }}>
                    <div className="stats-grid-revenue">
                        <div className="revenue-card">
                            <div className="revenue-section-free">
                                <h3>Monthly Fees Collection</h3>
                                <div 
                                    className="revenue-progress-container" 
                                    onClick={() => handleRevenueClick('monthly')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="revenue-progress-bar">
                                        <div 
                                            className="revenue-progress-fill" 
                                            style={{ width: `${(monthly.collected / monthly.expected * 100) || 0}%` }}
                                        ></div>
                                        <span className="progress-overlay-text">Monthly Collection</span>
                                    </div>
                                    <div className="revenue-details">
                                        <span>₹{monthly.collected.toLocaleString()} / ₹{monthly.expected.toLocaleString()}</span>
                                        <span>{((monthly.collected / monthly.expected * 100) || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="revenue-card">
                            <div className="revenue-section-free">
                                <h3>One-Time Fees Collection</h3>
                                <div 
                                    className="revenue-progress-container"
                                    onClick={() => handleRevenueClick('onetime')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="revenue-progress-bar">
                                        <div 
                                            className="revenue-progress-fill" 
                                            style={{ 
                                                width: `${(oneTime.collected / oneTime.expected * 100) || 0}%`,
                                                backgroundColor: '#8b5cf6'
                                            }}
                                        ></div>
                                        <span className="progress-overlay-text">One-Time Collection</span>
                                    </div>
                                    <div className="revenue-details">
                                        <span>₹{oneTime.collected.toLocaleString()} / ₹{oneTime.expected.toLocaleString()}</span>
                                        <span>{((oneTime.collected / oneTime.expected * 100) || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="stats-page-container">
            <header className="stats-header">
                <div className="header-left-group">
                    <button className="stats-back-btn" onClick={() => navigate(location.pathname.startsWith('/teacher-dashboard') ? '/teacher-dashboard' : '/dashboard')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <h1>Institute Analytics</h1>
                </div>
                <div className="date-picker-wrap">
                    <div className="custom-date-selector" onClick={() => document.getElementById('stats-hidden-date').showPicker()}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span className="selected-date-display">
                            {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <input 
                            id="stats-hidden-date"
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="stats-hidden-input"
                        />
                    </div>
                </div>
            </header>


            <div className="stats-tabs-container">
                <button 
                    className={`stats-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                    onClick={() => setActiveTab('students')}
                >
                    Students
                </button>
                <button 
                    className={`stats-tab-btn ${activeTab === 'teachers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teachers')}
                >
                    Teachers
                </button>
                {hasRevenueAccess && (
                    <button 
                        className={`stats-tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
                        onClick={() => setActiveTab('revenue')}
                    >
                        Revenue
                    </button>
                )}
            </div>

            {activeTab === 'students' && renderStudentsTab()}
            {activeTab === 'teachers' && renderTeachersTab()}
            {activeTab === 'revenue' && renderRevenueTab()}

            {/* Attendance Detail Modal */}
            {showModal && (
                <div className="stats-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="stats-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="stats-modal-header">
                            <div>
                                <h2>Class {selectedSection?.className} - {selectedSection?.section}</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    Attendance for {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button className="close-modal-btn" onClick={() => setShowModal(false)}>&times;</button>
                        </div>

                        <div className="modal-tabs">
                            <button 
                                className={`modal-tab-btn ${modalTab === 'present' ? 'active' : ''}`}
                                onClick={() => setModalTab('present')}
                            >
                                Present ({sectionStudents.filter(s => s.status === 'present').length})
                            </button>
                            <button 
                                className={`modal-tab-btn ${modalTab === 'absent' ? 'active' : ''}`}
                                onClick={() => setModalTab('absent')}
                            >
                                Absent ({sectionStudents.filter(s => s.status === 'absent').length})
                            </button>
                        </div>

                        <div className="modal-student-list">
                            {modalLoading ? (
                                <div className="empty-list-msg">Loading students...</div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="empty-list-msg">No students found in this list.</div>
                            ) : (
                                filteredStudents.map(student => (
                                    <div key={student.id} className="modal-student-item">
                                        <img 
                                            src={student.photo_url || 'https://via.placeholder.com/40'} 
                                            alt="" 
                                            className="modal-student-photo"
                                        />
                                        <div className="modal-student-info">
                                            <h4>{student.name}</h4>
                                            <p>Roll No: {student.roll_no}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Revenue Detail Modal */}
            {showRevenueModal && (
                <div className="stats-modal-overlay" onClick={() => setShowRevenueModal(false)}>
                    <div className="stats-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="stats-modal-header">
                            <div>
                                <h2>{revenueType === 'monthly' ? 'Monthly' : 'One-Time'} Collection</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    Details for {new Date(revenueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <button className="close-modal-btn" onClick={() => setShowRevenueModal(false)}>&times;</button>
                        </div>

                        <div className="modal-date-filter" style={{ padding: '1rem 2.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginRight: '10px' }}>Select Date:</label>
                            <input 
                                type="date" 
                                value={revenueDate}
                                onChange={(e) => setRevenueDate(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontWeight: '600'
                                }}
                            />
                        </div>

                        <div className="modal-student-list">
                            {revenueLoading ? (
                                <div className="empty-list-msg">Loading payments...</div>
                            ) : dailyRevenueData.length === 0 ? (
                                <div className="empty-list-msg">No payments recorded on this date.</div>
                            ) : (
                                dailyRevenueData.map((payment, idx) => (
                                    <div key={idx} className="modal-student-item">
                                        <img 
                                            src={payment.photo_url || 'https://via.placeholder.com/40'} 
                                            alt="" 
                                            className="modal-student-photo"
                                        />
                                        <div className="modal-student-info">
                                            <h4>{payment.name}</h4>
                                            <p>{payment.class}-{payment.section} | Roll: {payment.roll_no}</p>
                                        </div>
                                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                            <span style={{ fontSize: '1rem', fontWeight: '800', color: '#10b981' }}>+₹{parseFloat(payment.amount).toLocaleString()}</span>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{payment.fee_type || (revenueType === 'monthly' ? 'Monthly Fee' : 'One-Time Fee')}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Stats;
