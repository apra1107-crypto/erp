import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import './TeacherDashboard.css';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import { explainCode } from '../utils/codeHelper';
import Routine from './Routine';
import Attendance from './Attendance';
import TakeAttendance from './TakeAttendance';
import AdmitCard from './AdmitCard';
import IDCardView from './IDCardView';
import Fees from './Fees';



const TeacherDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState(null);
    const { theme, toggleTheme } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isAccountSwitchOpen, setIsAccountSwitchOpen] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [uniqueCode, setUniqueCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [schedule, setSchedule] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
    const profileRef = useRef(null);
    const sidebarRef = useRef(null);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserData(response.data.teacher);
            localStorage.setItem('userData', JSON.stringify(response.data.teacher));
            fetchSchedule();
        } catch (error) {
            console.error('Fetch profile error:', error);
            if (error.response?.status === 401) {
                handleLogout();
            }
            // Set loading to false so the UI doesn't hang
            setLoadingSchedule(false);
        }
    };

    const fetchSchedule = async () => {
        try {
            setLoadingSchedule(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teacher-schedule`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSchedule(response.data);
        } catch (error) {
            console.error('Error fetching teacher schedule:', error);
        } finally {
            setLoadingSchedule(false);
        }
    };

    const fetchAccounts = async (mobile) => {
        setLoadingAccounts(true);
        try {
            const response = await axios.post(`${API_ENDPOINTS.AUTH.TEACHER}/get-all-accounts`, { mobile });
            // Filter out current account
            const otherAccounts = response.data.accounts.filter(acc => acc.id !== userData.id);
            setAccounts(otherAccounts);
        } catch (error) {
            console.error('Fetch accounts error:', error);
            toast.error('Failed to fetch accounts');
        } finally {
            setLoadingAccounts(false);
        }
    };

    useEffect(() => {
        if (location.pathname === '/teacher-dashboard' && userData) {
            fetchSchedule();
        }
    }, [location.pathname, userData]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        const storedData = localStorage.getItem('userData');

        if (!token || userType !== 'teacher') {
            navigate('/');
            return;
        }

        if (storedData) {
            setUserData(JSON.parse(storedData));
        }

        fetchProfile();
    }, [navigate]);

    useEffect(() => {
        if (isProfileOpen && userData?.mobile && !selectedAccount) {
            fetchAccounts(userData.mobile);
        }
    }, [isProfileOpen, userData, selectedAccount]);

    // Handle click outside for Sidebar and Profile Menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsSidebarOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
                setIsAccountSwitchOpen(false);
                setSelectedAccount(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('userType');
        navigate('/');
    };

    const handleSwitchAccount = (account) => {
        setSelectedAccount(account);
        setUniqueCode('');
    };

    const handleVerifyAndSwitch = async () => {
        if (!uniqueCode) return toast.warning('Please enter unique code');

        try {
            setIsVerifying(true);
            const response = await axios.post(`${API_ENDPOINTS.AUTH.TEACHER}/verify-code`, {
                teacher_id: selectedAccount.id,
                access_code: uniqueCode
            });

            if (response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userData', JSON.stringify(response.data.teacher));
                localStorage.setItem('userType', 'teacher');
                setUserData(response.data.teacher);
                setIsProfileOpen(false);
                setIsAccountSwitchOpen(false);
                setSelectedAccount(null);
                toast.success(`Switched to ${response.data.teacher.institute_name}`);
                // Simple page reload to reset all states comfortably
                window.location.reload();
            }
        } catch (error) {
            console.error('Switch error:', error);
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setIsVerifying(false);
        }
    };

    const navigationItems = [
        { name: 'Dashboard', path: '/teacher-dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
        { name: 'My Students', path: '/teacher-dashboard/students', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
        { name: 'Routine', path: '/teacher-dashboard/routine', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
        { name: 'Attendance', path: '/teacher-dashboard/attendance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
        { name: 'Admit Card', path: '/teacher-dashboard/admit-card', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg> },
        { name: 'Identity Card', path: '/teacher-dashboard/id-card', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
        ...(userData?.special_permission ? [
            { name: 'Fees', path: '/teacher-dashboard/fees', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg> }
        ] : []),
    ];

    const handleNavClick = (path) => {
        navigate(path);
        if (window.innerWidth <= 1024) {
            setIsSidebarOpen(false);
        }
    };



    // Internal Dashboard Home Component
    const TeacherOverview = () => (
        <>
            {schedule.length > 0 && (
                <section className="teacher-today-routine fadeIn" onClick={() => setIsWeeklyModalOpen(true)}>
                    <div className="routine-badge-floating">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="routine-expand-hint">
                        View Full Week
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
                    </div>

                    <div className="today-slots-scroller">
                        {(() => {
                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const todayIndex = new Date().getDay();
                            const todayName = days[todayIndex];
                            const todayClasses = (schedule || []).filter(s => s.day === todayName);

                            if (todayClasses.length === 0) {
                                return <div className="no-classes-today">No lectures scheduled for {todayName}. Enjoy your day!</div>;
                            }

                            return todayClasses.map((item, idx) => (
                                <div key={idx} className="today-lecture-pill">
                                    <span className="p-time">{item.startTime}</span>
                                    <div className="p-core">
                                        <p className="p-subject">{item.subject}</p>
                                        <span className="p-target">Class {item.className}-{item.section}</span>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </section>
            )}

            <div className="welcome-banner">
                <div className="banner-text">
                    <h2>Welcome, {userData.name}!</h2>
                    <p>Academic Portal | Subject: <strong>{userData.subject}</strong></p>
                </div>
                <div className="status-notice">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <span>Verified Official Profile (View Only)</span>
                </div>
            </div>

            <div className="info-grid">
                <div className="info-card">
                    <label>Institute name</label>
                    <p>{userData.institute_name}</p>
                </div>
                <div className="info-card">
                    <label>Email Address</label>
                    <p>{userData.email || 'N/A'}</p>
                </div>
                <div className="info-card">
                    <label>Mobile Number</label>
                    <p>{userData.mobile}</p>
                </div>
                <div className="info-card">
                    <label>Subject Expertise</label>
                    <p>{userData.subject}</p>
                </div>
                <div className="info-card">
                    <label>Qualification</label>
                    <p>{userData.qualification}</p>
                </div>
                <div className="info-card">
                    <p
                        className="status-notice-small text-success"
                        title={userData?.unique_code ? `Official ID: ${userData.unique_code} • ${explainCode(userData.unique_code)}` : 'ID Verified'}
                        style={{ cursor: 'help' }}
                    >
                        Verified Official ID
                    </p>
                </div>
            </div>

            <div className="mgmt-notice">
                <p>Note: Regular details are managed by the institute administration. To request updates, please contact the Principal's office.</p>
            </div>
        </>
    );

    if (!userData) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className={`theme-${theme} dashboard-wrapper ${isSidebarOpen ? 'sidebar-active' : ''}`}>
            {/* Sidebar Overlay */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

            {/* Sidebar Component */}
            <aside ref={sidebarRef} className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo-group">
                        <div className="sidebar-logo">
                            {userData.institute_logo ? (
                                <img src={userData.institute_logo} alt="Logo" />
                            ) : (
                                <span>{userData.institute_name?.charAt(0)}</span>
                            )}
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navigationItems.map(item => (
                        <div
                            key={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => handleNavClick(item.path)}
                        >
                            {item.icon}
                            <span>{item.name}</span>
                        </div>
                    ))}
                </nav>
            </aside>

            <div className="main-container">
                <header className="dashboard-header">
                    <div className="header-left">
                        {!isSidebarOpen && (
                            <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                            </button>
                        )}
                    </div>

                    <div className="header-center">
                        <div className="inst-branding">
                            <div className="header-inst-logo">
                                {userData.institute_logo ? (
                                    <img src={userData.institute_logo} alt="Logo" />
                                ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" /></svg>
                                )}
                            </div>
                            <h1 className="inst-name-header">{(userData.institute_name || '').toUpperCase()}</h1>
                        </div>
                    </div>

                    <div className="header-right">
                        <div className="profile-trigger" ref={profileRef} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <img
                                src={userData.photo_url || 'https://via.placeholder.com/150'}
                                alt={userData.name}
                                className="user-avatar"
                            />
                            {isProfileOpen && (
                                <div className="profile-dialog" onClick={(e) => e.stopPropagation()}>
                                    <div className="dialog-header">
                                        <div className="dialog-user-info">
                                            <p className="dialog-name">{userData.name}</p>
                                            <p className="dialog-email">{userData.email || 'No email set'}</p>
                                            <p className="dialog-mobile">{userData.mobile}</p>
                                        </div>
                                    </div>

                                    <div className="account-switch-section">
                                        {!selectedAccount ? (
                                            <>
                                                <button
                                                    className="dialog-btn account-switch-trigger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsAccountSwitchOpen(prev => !prev);
                                                        if (!isAccountSwitchOpen && userData?.mobile) { // If opening, fetch accounts
                                                            fetchAccounts(userData.mobile);
                                                        }
                                                    }}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
                                                    Account Switch
                                                </button>

                                                {isAccountSwitchOpen && (accounts.length > 0 || loadingAccounts) && (
                                                    <div className="accounts-dropdown">
                                                        {loadingAccounts ? (
                                                            <div className="loading-small">Loading accounts...</div>
                                                        ) : accounts.length > 0 ? (
                                                            <div className="accounts-list">
                                                                {accounts.map(acc => (
                                                                    <div key={acc.id} className="account-item" onClick={() => handleSwitchAccount(acc)} title={`Switch to ${acc.institute_name} (${acc.name}) • Code: ${acc.unique_code} (${explainCode(acc.unique_code)})`}>
                                                                        <img src={acc.institute_logo || '/default-inst.png'} alt="Inst" />
                                                                        <div className="acc-details">
                                                                            <p className="inst-name">{acc.institute_name}</p>
                                                                            <p className="acc-meta">{acc.name}</p>
                                                                        </div>
                                                                        <div className="switch-icon">
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 7-3-3-3 3" /><path d="M18 4v10a4 4 0 0 1-4 4H4" /><path d="m3 17 3 3 3-3" /><path d="M6 20V10a4 4 0 0 1 4-4h10" /></svg>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="no-other-acc">No other institutes found</p>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="verify-switch-view">
                                                <div className="verify-header">
                                                    <button className="back-btn-small" onClick={() => setSelectedAccount(null)}>
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                                                    </button>
                                                    <span>Verify Identity</span>
                                                </div>
                                                <div className="target-account-info">
                                                    <p>Switching to <strong>{selectedAccount.institute_name}</strong></p>
                                                    <span className="target-teacher-tag">{selectedAccount.name}</span>
                                                </div>
                                                <div className="pin-input-container">
                                                    <label>Enter 6-Digit unique code</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: 6A2B3D"
                                                        className="pin-modern-input"
                                                        value={uniqueCode}
                                                        onChange={(e) => setUniqueCode(e.target.value)}
                                                        maxLength={10}
                                                        autoFocus
                                                    />
                                                </div>
                                                <button
                                                    className="modern-switch-btn"
                                                    onClick={handleVerifyAndSwitch}
                                                    disabled={isVerifying || !uniqueCode}
                                                >
                                                    {isVerifying ? 'Verifying...' : 'Complete Switch'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="dialog-divider"></div>

                                    <div className="dialog-actions">
                                        <button className="dialog-btn">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            My Profile
                                        </button>
                                        <button className="dialog-btn" onClick={(e) => { e.stopPropagation(); toggleTheme(); }}>
                                            {theme === 'dark' ? (
                                                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> Light Mode</>
                                            ) : (
                                                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> Dark Mode</>
                                            )}
                                        </button>
                                        <button className="dialog-btn logout-item" onClick={handleLogout}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className={`dashboard-content ${location.pathname.includes('/fees') ? 'fees-mode' : ''}`}>
                    <Routes>
                        <Route path="/" element={<TeacherOverview />} />
                        <Route path="/routine" element={<Routine />} />
                        <Route path="/attendance" element={<Attendance />} />
                        <Route path="/attendance/:class/:section" element={<TakeAttendance />} />

                        <Route path="/admit-card" element={<AdmitCard />} />
                        <Route path="/id-card" element={<IDCardView userData={userData} />} />
                        {userData?.special_permission && <Route path="/fees" element={<Fees />} />}

                        <Route path="*" element={<div className="no-items-placeholder"><h3>Coming Soon</h3><p>This module is under development.</p></div>} />
                    </Routes>
                </main>

                {isWeeklyModalOpen && (
                    <div className="weekly-routine-overlay fadeIn" onClick={() => setIsWeeklyModalOpen(false)}>
                        <div className="weekly-routine-modal" onClick={e => e.stopPropagation()}>
                            <header className="modal-header-premium">
                                <div>
                                    <h2>My Weekly Academic Flow</h2>
                                    <p>{userData.name} • {userData.subject} Faculty</p>
                                </div>
                                <button className="modal-close-btn-premium" onClick={() => setIsWeeklyModalOpen(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </header>

                            <div className="modal-scroll-content">
                                <div className="weekly-grid-teacher">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                        const dayClasses = schedule.filter(s => s.day === day);
                                        if (dayClasses.length === 0) return null;

                                        return (
                                            <div key={day} className="day-column-custom">
                                                <div className="day-name-sticky">{day}</div>
                                                <div className="lecture-cards-stack">
                                                    {dayClasses.map((item, idx) => (
                                                        <div key={idx} className="lecture-card-modern">
                                                            <div className="l-time-badge">{item.startTime} - {item.endTime}</div>
                                                            <h4 className="l-subject-name">{item.subject}</h4>
                                                            <div className="l-class-pills">
                                                                <span className="pill-target">{item.className}-{item.section}</span>
                                                                <span className="pill-label">{item.label}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherDashboard;
