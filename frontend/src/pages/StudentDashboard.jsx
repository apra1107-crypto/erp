import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './StudentDashboard.css';
import StudentProfileModal from '../components/StudentProfileModal';
import { useTheme } from '../context/ThemeContext';

const StudentDashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const [fees, setFees] = useState([]);
    const [routine, setRoutine] = useState(null);
    const [teachers, setTeachers] = useState([]);
    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);

    // Account Switching State
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [uniqueCode, setUniqueCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const profileData = response.data.student;
            setUserData(profileData);
            localStorage.setItem('userData', JSON.stringify(profileData));
            fetchFees(profileData.id);
            fetchMyRoutine();
            fetchTeachers();
        } catch (error) {
            console.error('Fetch profile error:', error);
            if (error.response?.status === 401) {
                handleLogout();
            }
        }
    };

    const fetchMyRoutine = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/my-routine`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRoutine(response.data);
        } catch (error) {
            console.error('Error fetching routine:', error);
        }
    };

    const fetchTeachers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teachers-list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeachers(response.data);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        }
    };



    const fetchFees = async (studentId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.FEES}/student/${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFees(response.data.history);
        } catch (error) {
            console.error('Fetch fees error:', error);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        const storedData = localStorage.getItem('userData');

        if (!token || userType !== 'student') {
            navigate('/');
            return;
        }

        if (storedData) {
            const parsed = JSON.parse(storedData);
            setUserData(parsed);
            fetchFees(parsed.id);
        }

        fetchProfile();

        const handleClickOutside = (e) => {
            if (showProfilePopup && !e.target.closest('.student-profile-trigger') && !e.target.closest('.student-popup')) {
                setShowProfilePopup(false);
                setIsSwitcherOpen(false);
                setSelectedAccount(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [navigate, showProfilePopup]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('userType');
        toast.success('Logged out successfully');
        navigate('/');
    };

    const handleSwitchAccClick = async (e) => {
        e.stopPropagation();
        try {
            const response = await axios.post(`${API_ENDPOINTS.AUTH.STUDENT}/get-all-accounts`, {
                mobile: userData.mobile
            });
            setAccounts(response.data.accounts);
            setIsSwitcherOpen(true);
        } catch (error) {
            toast.error('Failed to fetch accounts');
        }
    };

    const handleSelectAcc = (acc) => {
        if (acc.id === userData.id) return; // Prevent switching to self
        setSelectedAccount(acc);
        setUniqueCode('');
    };

    const handleVerifyAndSwitch = async () => {
        if (!uniqueCode) return toast.warning('Please enter unique code');

        try {
            setIsVerifying(true);
            const response = await axios.post(`${API_ENDPOINTS.AUTH.STUDENT}/verify-code`, {
                student_id: selectedAccount.id,
                access_code: uniqueCode
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('userData', JSON.stringify(response.data.student));
            localStorage.setItem('userType', 'student');

            toast.success(`Switched to ${response.data.student.name}`);
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleProfileUpdate = (updatedData) => {
        setUserData(updatedData);
        localStorage.setItem('userData', JSON.stringify(updatedData));
    };

    if (!userData) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className={`student-dashboard theme-${theme}`}>
            <header className="student-header-modern">
                <div className="header-left">
                    <div className="inst-meta">
                        <div className="student-inst-logo">
                            {userData.institute_logo ? (
                                <img src={userData.institute_logo} alt="Institute Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" />
                                </svg>
                            )}
                        </div>
                        <h1 className="inst-name uppercase">{(userData.institute_name || '').toUpperCase()}</h1>
                    </div>
                </div>

                <div className="header-right">
                    <div className="student-profile-trigger" onClick={() => setShowProfilePopup(!showProfilePopup)}>
                        <div className="header-user-meta">
                            <span className="header-user-name">{userData.name}</span>
                            <div className="header-user-sub">
                                <span>Class {userData.class}-{userData.section}</span>
                                <span className="header-dot">•</span>
                                <span>Roll: {userData.roll_no}</span>
                            </div>
                        </div>
                        <img
                            src={userData.photo_url || 'https://via.placeholder.com/150'}
                            alt={userData.name}
                            className="student-avatar-main"
                        />
                        {showProfilePopup && (
                            <div className="student-popup" onClick={(e) => e.stopPropagation()}>
                                {!isSwitcherOpen ? (
                                    <>
                                        <div className="popup-menu" style={{ paddingTop: '0.5rem' }}>
                                            <button className="popup-item" onClick={handleSwitchAccClick}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18" /></svg>
                                                Switch Account
                                            </button>
                                            <button className="popup-item" onClick={() => { setShowProfileModal(true); setShowProfilePopup(false); }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                My Profile
                                            </button>
                                            <button className="popup-item" onClick={toggleTheme}>
                                                {theme === 'light' ? (
                                                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> Dark Mode</>
                                                ) : (
                                                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> Light Mode</>
                                                )}
                                            </button>
                                            <div className="popup-divider"></div>
                                            <button className="popup-item logout" onClick={handleLogout}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                                                Logout
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="acc-switcher-view">
                                        <div className="switcher-header">
                                            <button className="back-btn" onClick={() => setIsSwitcherOpen(false)}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                                            </button>
                                            <h3>Switch Account</h3>
                                        </div>

                                        {!selectedAccount ? (
                                            <div className="acc-list premium-list">
                                                {accounts.map(acc => (
                                                    <button
                                                        key={acc.id}
                                                        className={`acc-item-pro ${acc.id === userData.id ? 'active-profile' : ''}`}
                                                        onClick={() => handleSelectAcc(acc)}
                                                    >
                                                        <div className="acc-avatar-pro">
                                                            {acc.photo_url ? <img src={acc.photo_url} alt="" /> : <span>{acc.name.charAt(0)}</span>}
                                                            {acc.id === userData.id && <div className="online-indicator"></div>}
                                                        </div>
                                                        <div className="acc-details-pro">
                                                            <p className="acc-name-pro">{acc.name}</p>
                                                            <p className="acc-inst-pro">{acc.institute_name}</p>
                                                            <span className="acc-meta-pro">Class {acc.class} • Roll {acc.roll_no}</span>
                                                        </div>
                                                        {acc.id === userData.id ? (
                                                            <span className="status-current">Active</span>
                                                        ) : (
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="verify-view-pro">
                                                <div className="verify-target">
                                                    <div className="target-avatar">
                                                        <img src={selectedAccount.photo_url || 'https://via.placeholder.com/150'} alt="" />
                                                    </div>
                                                    <p>Verifying Access for <br /><strong>{selectedAccount.name}</strong></p>
                                                </div>

                                                <div className="pin-input-group">
                                                    <label>Enter 6-Digit Unique Code</label>
                                                    <input
                                                        type="text"
                                                        className="pin-box"
                                                        placeholder="Enter Unique Code"
                                                        value={uniqueCode}
                                                        onChange={(e) => setUniqueCode(e.target.value)}
                                                        maxLength={10}
                                                        autoFocus
                                                    />
                                                </div>

                                                <button
                                                    className="confirm-switch-btn"
                                                    onClick={handleVerifyAndSwitch}
                                                    disabled={isVerifying || uniqueCode.length < 6}
                                                >
                                                    {isVerifying ? 'Verifying...' : 'Switch Identity'}
                                                </button>
                                                <button className="cancel-switch-link" onClick={() => setSelectedAccount(null)}>Choose another student</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="student-main-content">
                <div className="overview-grid">
                    <div className="welcome-card-modern">
                        <div className="welcome-info">
                            <h2>Hello, {userData.name.split(' ')[0]}! 👋</h2>
                            <p>Here's your academic summary for today.</p>
                        </div>
                        <div className="quick-stats">
                            <div className="q-stat">
                                <label>Attendance</label>
                                <span>94%</span>
                            </div>
                            <div className="q-stat">
                                <label>Assignments</label>
                                <span>03</span>
                            </div>
                        </div>
                    </div>

                    <div className="student-stats-row">
                        <div className="s-stat-card attendance">
                            <div className="s-icon purple">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            </div>
                            <div className="s-info">
                                <h3>Attendance</h3>
                                <p>Overall Presence</p>
                                <span className="val">94.5%</span>
                            </div>
                        </div>
                        <div className="s-stat-card fees" onClick={() => navigate('/student-dashboard/fees')}>
                            <div className="s-icon green">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><path d="M7 15h.01M12 15h.01M17 15h.01" /></svg>
                            </div>
                            <div className="s-info">
                                <h3>Fees Status</h3>
                                <p>{fees.some(f => f.status === 'unpaid') ? 'Dues Pending' : 'All Clear'}</p>
                                <span className={`val ${fees.some(f => f.status === 'unpaid') ? 'pink' : 'green'}`}>
                                    {fees.some(f => f.status === 'unpaid') ? 'Pending' : 'Paid'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {routine && (
                    <section className="routine-overview-section">
                        <div className="section-header-pro">
                            <div className="title-stack-pro">
                                <span className="title-badge-pro">TIMETABLE</span>
                                <h2>Today's Schedule</h2>
                            </div>
                            <button className="view-weekly-btn" onClick={() => setIsRoutineModalOpen(true)}>
                                Weekly View
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
                            </button>
                        </div>

                        <div className="today-routine-card-pro" onClick={() => setIsRoutineModalOpen(true)}>
                            <div className="routine-cards-container">
                                {(() => {
                                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    const today = days[new Date().getDay()];
                                    const slots = routine.config.slots || [];
                                    const todayData = routine.data[today] || [];

                                    if (slots.length === 0 || !todayData.length) {
                                        return (
                                            <div className="no-routine-placeholder">
                                                <div className="placeholder-icon">☕</div>
                                                <p>No classes scheduled for {today}. Enjoy your day!</p>
                                            </div>
                                        );
                                    }

                                    return slots.map((slotConfig, pIdx) => {
                                        const slotData = todayData[pIdx] || {};
                                        // Simple time check for "Live" period
                                        const now = new Date();
                                        const currentTime = now.getHours() * 60 + now.getMinutes();

                                        const parseTime = (t) => {
                                            const [time, modifier] = t.split(' ');
                                            let [hours, minutes] = time.split(':');
                                            hours = parseInt(hours);
                                            minutes = parseInt(minutes);
                                            if (modifier === 'PM' && hours < 12) hours += 12;
                                            if (modifier === 'AM' && hours === 12) hours = 0;
                                            return hours * 60 + minutes;
                                        };

                                        let isLive = false;
                                        try {
                                            const start = parseTime(slotConfig.startTime);
                                            const end = parseTime(slotConfig.endTime);
                                            isLive = currentTime >= start && currentTime <= end;
                                        } catch (e) { }

                                        if (slotConfig.type === 'break') {
                                            return (
                                                <div key={slotConfig.id || pIdx} className={`routine-slot-pro break ${isLive ? 'live-slot' : ''}`}>
                                                    <div className="slot-time-pro">{slotConfig.startTime} - {slotConfig.endTime}</div>
                                                    <div className="slot-content-pro">
                                                        <span className="slot-subject-pro">{slotConfig.label}</span>
                                                        <span className="slot-type-badge break">Rest</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={slotConfig.id || pIdx} className={`routine-slot-pro ${slotData.subject ? 'filled' : 'empty'} ${isLive ? 'live-slot' : ''}`}>
                                                {isLive && <div className="live-indicator-pro"><span></span>LIVE</div>}
                                                <div className="slot-time-pro">{slotConfig.startTime} - {slotConfig.endTime}</div>
                                                <div className="slot-content-pro">
                                                    <span className="slot-subject-pro">{slotData.subject || 'Free Period'}</span>
                                                    <div className="slot-footer-pro">
                                                        <span className="slot-teacher-pro">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                            {slotData.teacherId ? (
                                                                teachers.find(t => String(t.id) === String(slotData.teacherId))?.name || 'Class Teacher'
                                                            ) : (
                                                                slotData.subject ? 'Main Faculty' : '-'
                                                            )}
                                                        </span>
                                                        {slotData.subject && <span className="slot-type-badge">Lecture</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </section>
                )}

                <div className="features-grid">
                    {[
                        { title: 'Attendance', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: '#ec4899' },
                        { title: 'Fees', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>, color: '#8b5cf6' },

                        { title: 'Transport', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="22" height="13" rx="2" /><path d="M4 16v4h2v-4M18 16v4h2v-4M4 13h16" /></svg>, color: '#06b6d4' },
                        { title: 'Admit Card', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg>, color: '#10b981' },
                        { title: 'Identity Card', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" /><circle cx="12" cy="7" r="4" /></svg>, color: '#f97316' },
                        { title: 'Exams', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>, color: '#8b5cf6' }
                    ].map((feature, i) => (
                        <div key={i} className="feature-card">
                            <div className="feature-icon" style={{ backgroundColor: `${feature.color}15`, color: feature.color }}>
                                {feature.icon}
                            </div>
                            <h3>{feature.title}</h3>
                            <button
                                className="view-btn"
                                onClick={() => {
                                    if (feature.title === 'Attendance') navigate('/student-dashboard/attendance-history');
                                    else if (feature.title === 'Fees') navigate('/student-dashboard/fees');
                                    else if (feature.title === 'Admit Card') navigate('/student-dashboard/admit-card');
                                    else if (feature.title === 'Identity Card') navigate('/student-dashboard/id-card');
                                }}
                            >
                                View All
                            </button>
                        </div>
                    ))}
                </div>

                <StudentProfileModal
                    isOpen={showProfileModal}
                    onClose={() => setShowProfileModal(false)}
                    userData={userData}
                    onUpdate={handleProfileUpdate}
                    onSwitchAccount={handleSwitchAccClick}
                />

                {isRoutineModalOpen && routine && (
                    <div className="routine-modal-overlay fadeIn" onClick={() => setIsRoutineModalOpen(false)}>
                        <div className="routine-modal-card" onClick={e => e.stopPropagation()}>
                            <header className="modal-header">
                                <div>
                                    <h2>Weekly Timetable</h2>
                                    <p>Class {userData.class} - {userData.section}</p>
                                </div>
                                <button className="close-modal-btn" onClick={() => setIsRoutineModalOpen(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </header>

                            <div className="modal-scroll-area">
                                <table className="student-routine-grid">
                                    <thead>
                                        <tr>
                                            <th>Period</th>
                                            {routine.config.days.map(day => <th key={day}>{day}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {routine.config.slots.map((slot, sIdx) => (
                                            <tr key={slot.id} className={slot.type === 'break' ? 'break-row' : ''}>
                                                <td className="time-col">
                                                    <div className="p-label text-primary">{slot.label}</div>
                                                    <div className="p-time text-secondary">{slot.startTime} - {slot.endTime}</div>
                                                </td>
                                                {routine.config.days.map(day => {
                                                    const dayData = routine.data[day]?.[sIdx];

                                                    if (slot.type === 'break') {
                                                        return (
                                                            <td key={day} className="break-cell">
                                                                <div className="break-stripe"></div>
                                                                <div className="break-tag">BREAK</div>
                                                            </td>
                                                        );
                                                    }

                                                    return (
                                                        <td key={day} className={`grid-slot-cell ${dayData?.subject ? 'active' : ''}`}>
                                                            {dayData?.subject ? (
                                                                <>
                                                                    <div className="g-subject text-primary">{dayData.subject}</div>
                                                                    <div className="g-teacher text-secondary">
                                                                        {dayData.teacherId ? (
                                                                            teachers.find(t => String(t.id) === String(dayData.teacherId))?.name || 'Class Teacher'
                                                                        ) : (dayData.subject ? 'Main Faculty' : '-')}
                                                                    </div>
                                                                </>
                                                            ) : <span className="free-tag">Free</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default StudentDashboard;
