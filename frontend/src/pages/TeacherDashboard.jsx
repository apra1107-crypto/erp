import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS, BASE_URL } from '../config';
import './TeacherDashboard.css';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';
import { explainCode } from '../utils/codeHelper';
import Routine from './Routine';
import Attendance from './Attendance';
import TakeAttendance from './TakeAttendance';
import Stats from './Stats';
import AdmitCard from './AdmitCard';
import IDCardView from './IDCardView';
import Fees from './Fees';
import Transport from './Transport';
import RouteManagement from './RouteManagement';
import LiveTracking from './LiveTracking';
import TeacherStudents from './TeacherStudents';
import ResultDashboard from './ResultManagement/ResultDashboard';
import CreateExam from './ResultManagement/CreateExam';
import DataEntryGrid from './ResultManagement/DataEntryGrid';
import ReportCardPage from './ResultManagement/ReportCardPage';

const TeacherDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userData, setUserData] = useState(null);
    const { theme, toggleTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);
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

    // Carousel & Stats State
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [statsData, setStatsData] = useState(null);
    const [teacherAttendance, setTeacherAttendance] = useState(null);
    const [isMarking, setIsMarking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserData(response.data.teacher);
            localStorage.setItem('userData', JSON.stringify(response.data.teacher));
            fetchSchedule();
            fetchDashboardStats();
            fetchTeacherAttendance();
        } catch (error) {
            console.error('Fetch profile error:', error);
            if (error.response?.status === 401) {
                handleLogout();
            }
            setLoadingSchedule(false);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatsData(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchTeacherAttendance = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${BASE_URL}/api/teacher-attendance/today`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeacherAttendance(response.data);
        } catch (error) {
            console.error('Error fetching teacher attendance:', error);
        }
    };

    const handleMarkAttendance = async (status) => {
        setIsMarking(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${BASE_URL}/api/teacher-attendance/mark`, 
                { status },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTeacherAttendance(response.data.record);
            toast.success(`Marked as ${status.toUpperCase()}`);
        } catch (error) {
            toast.error('Failed to mark attendance');
        } finally {
            setIsMarking(false);
        }
    };

    // Carousel Logic
    useEffect(() => {
        if (isPaused) return;
        const totalCards = userData?.special_permission ? 3 : 2; // Dynamic count
        const interval = setInterval(() => {
            setActiveCardIndex((prev) => (prev + 1) % totalCards);
        }, 3000);
        return () => clearInterval(interval);
    }, [userData, isPaused]);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!isCollapsed && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsCollapsed(true);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
                setIsAccountSwitchOpen(false);
                setSelectedAccount(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCollapsed]);

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
        { name: 'Dashboard', path: '/teacher-dashboard', color: '#3b82f6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
        { name: 'My Students', path: '/teacher-dashboard/students', color: '#10b981', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
        { name: 'Routine', path: '/teacher-dashboard/routine', color: '#8b5cf6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
        { name: 'Attendance', path: '/teacher-dashboard/attendance', color: '#8b5cf6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
        { name: 'Admit Card', path: '/teacher-dashboard/admit-card', color: '#f97316', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg> },
        { name: 'Results', path: '/teacher-dashboard/results', color: '#ef4444', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
        { name: 'Stats', path: '/teacher-dashboard/stats', color: '#10b981', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
        { name: 'Identity Card', path: '/teacher-dashboard/id-card', color: '#6366f1', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
        { name: 'Transport', path: '/teacher-dashboard/transport', color: '#06b6d4', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5" /></svg> },
        ...(userData?.special_permission ? [
            { name: 'Fees', path: '/teacher-dashboard/fees', color: '#10b981', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /><path d="M16 14v4M12 14v4M8 14v4" /></svg> },
        ] : []),
    ];

    const handleNavClick = (path) => {
        navigate(path);
        if (window.innerWidth <= 1024) {
            setIsCollapsed(true);
        }
    };

    // Shared calculations for the overview
    const studentTotal = statsData?.students?.total || 0;
    const studentPresent = statsData?.attendance?.today?.students?.find(s => s.status === 'present')?.count || 0;
    const studentAbsent = statsData?.attendance?.today?.students?.find(s => s.status === 'absent')?.count || 0;

    const teacherTotal = statsData?.teachers?.total || 0;
    const teacherPresentCount = statsData?.attendance?.today?.teachers?.find(t => t.status === 'present')?.count || 0;

    const revenueMonthly = statsData?.revenue?.monthly || { expected: 0, collected: 0 };
    const revenueOneTime = statsData?.revenue?.oneTime || { expected: 0, collected: 0 };
    const totalCollected = (revenueMonthly.collected || 0) + (revenueOneTime.collected || 0);
    const totalExpected = (revenueMonthly.expected || 0) + (revenueOneTime.expected || 0);
    const totalLeft = totalExpected - totalCollected;

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dayStr = today.toLocaleDateString('en-IN', { weekday: 'long' });

    if (!userData) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className={`theme-${theme} dashboard-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Navigation Sidebar */}
            <aside ref={sidebarRef} className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header-spacer"></div>
                <nav className="sidebar-nav">
                    {navigationItems.map(item => (
                        <button
                            key={item.path}
                            className={`sidebar-nav-btn ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => handleNavClick(item.path)}
                            title={isCollapsed ? item.name : ''}
                            style={{ '--accent-color': item.color }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-text">{item.name}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button
                        className="collapse-toggle-btn"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        {!isCollapsed && <span className="collapse-text">Collapse Menu</span>}
                    </button>
                </div>
            </aside>

            <div className="main-container">
                <header className="dashboard-header">
                    <div className="header-left"></div>
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
                                                        if (!isAccountSwitchOpen && userData?.mobile) {
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
                                                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" /><line x1="18.36" y1="18.36" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg> Light Mode</>
                                            ) : (
                                                <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> Dark Mode</>
                                            )}
                                        </button>
                                        <button className="dialog-btn logout-item" onClick={handleLogout}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="dashboard-content">
                    <Routes>
                        <Route path="/" element={
                            <div className="standard-padded-content">
                                <div className="hero-flex-layout">
                                    <div className="welcome-banner">
                                        <div className="banner-text">
                                            <h2>Welcome, {userData?.name}!</h2>
                                            <p>Academic Portal | Subject: <strong>{userData?.subject}</strong></p>
                                        </div>
                                    </div>

                                                                        <div 
                                        className="stat-flashcard-carousel"
                                        onMouseEnter={() => setIsPaused(true)}
                                        onMouseLeave={() => setIsPaused(false)}
                                    >

                                                                            {/* CARD 1: Teacher Self Attendance (PRIORITIZED) */}

                                                                            <div className={`stat-flashcard-hero ${activeCardIndex === 0 ? 'active' : 'hidden'}`} onClick={() => navigate('/teacher-dashboard/stats')}>

                                                                                <div className="sf-header">

                                                                                    <div className="sf-icon-wrap" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>

                                                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>

                                                                                    </div>

                                                                                    <span className="sf-label">MARK MY ATTENDANCE</span>

                                                                                </div>

                                                                                <div className="sf-marking-area">

                                                                                    {teacherAttendance ? (

                                                                                                                                                                                <div className="attendance-status-box post-mark-view fadeIn">

                                                                                                                                                                                    <div className="post-mark-split">

                                                                                                                                                                                        <div className="pm-left">

                                                                                                                                                                                            <div className="staff-presence-hero">

                                                                                                                                                                                                <div className="p-huge-val">

                                                                                                                                                                                                    <span>{teacherPresentCount}</span>

                                                                                                                                                                                                    <small>/ {teacherTotal}</small>

                                                                                                                                                                                                </div>

                                                                                                                                                                                                <div className="p-label-hero">Teachers Present Today</div>

                                                                                                                                                                                            </div>

                                                                                                                                                                                        </div>

                                                                                                                                                                                        

                                                                                                                                                                                        <div className="pm-divider"></div>

                                                                                                                                    

                                                                                                                                                                                        <div className="pm-right">

                                                                                                                                                                                            <div className={`status-pill-hero ${teacherAttendance.status}`}>

                                                                                                                                                                                                {teacherAttendance.status === 'present' ? '✔ PRESENT' : '✖ ABSENT'}

                                                                                                                                                                                            </div>

                                                                                                                                                                                            <div className="marked-time-main">

                                                                                                                                                                                                {new Date(teacherAttendance.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}

                                                                                                                                                                                            </div>

                                                                                                                                                                                        </div>

                                                                                                                                                                                    </div>

                                                                                                                                                                                </div>

                                                                                    ) : (

                                                                                        <div className="marking-btns-hero">

                                                                                            <button className="btn-mark present" onClick={(e) => { e.stopPropagation(); handleMarkAttendance('present'); }} disabled={isMarking}>

                                                                                                Present

                                                                                            </button>

                                                                                            <button className="btn-mark absent" onClick={(e) => { e.stopPropagation(); handleMarkAttendance('absent'); }} disabled={isMarking}>

                                                                                                Absent

                                                                                            </button>

                                                                                        </div>

                                                                                    )}

                                                                                </div>

                                                                                <div className="sf-footer">

                                                                                    <span className="sf-meta">{dateStr} • {dayStr}</span>

                                                                                </div>

                                                                            </div>

                                    

                                                                            {/* CARD 2: Student Attendance */}

                                                                            <div className={`stat-flashcard-hero ${activeCardIndex === 1 ? 'active' : 'hidden'}`} onClick={() => navigate('/teacher-dashboard/stats')}>

                                                                                <div className="sf-header">

                                                                                    <div className="sf-icon-wrap">

                                                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>

                                                                                    </div>

                                                                                    <span className="sf-label">STUDENT ATTENDANCE</span>

                                                                                </div>

                                                                                <div className="sf-main-stats">

                                                                                    <div className="sf-stat-item">

                                                                                        <span className="sf-val">{studentPresent} <small style={{ fontSize: '1rem', opacity: 0.6 }}>/ {studentTotal}</small></span>

                                                                                        <label>Present Today</label>

                                                                                    </div>

                                                                                    <div className="sf-divider"></div>

                                                                                    <div className="sf-stat-item">

                                                                                        <span className="sf-val" style={{ color: studentAbsent > 0 ? '#f59e0b' : 'inherit' }}>{studentAbsent}</span>

                                                                                        <label>Absent Today</label>

                                                                                    </div>

                                                                                </div>

                                                                                <div className="sf-footer">

                                                                                    <span className="sf-meta">{dateStr} • {dayStr} • {timeStr}</span>

                                                                                </div>

                                                                            </div>

                                        {/* CARD 3: Revenue (Conditional) */}
                                        {userData?.special_permission && (
                                            <div className={`stat-flashcard-hero ${activeCardIndex === 2 ? 'active' : 'hidden'}`} onClick={() => navigate('/teacher-dashboard/stats', { state: { activeTab: 'revenue' } })}>
                                                <div className="sf-header">
                                                    <div className="sf-icon-wrap" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M16 14v4M12 14v4M8 14v4"/></svg>
                                                    </div>
                                                    <span className="sf-label">MONTHLY REVENUE</span>
                                                </div>
                                                
                                                <div className="sf-progress-mini top-progress">
                                                    <div className="sf-progress-fill" style={{ width: `${(totalCollected / totalExpected * 100) || 0}%`, background: 'white' }}></div>
                                                </div>

                                                <div className="sf-main-stats">
                                                    <div className="sf-stat-item">
                                                        <span className="sf-val">₹{totalCollected.toLocaleString()}</span>
                                                        <label>Collected</label>
                                                    </div>
                                                    <div className="sf-divider"></div>
                                                    <div className="sf-stat-item">
                                                        <span className="sf-val" style={{ color: '#ffedd5' }}>₹{totalLeft.toLocaleString()}</span>
                                                        <label>Remaining</label>
                                                    </div>
                                                </div>
                                                <div className="sf-footer">
                                                    <span className="sf-meta">{dateStr} • {dayStr}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="stat-carousel-dots">
                                            {[...Array(userData?.special_permission ? 3 : 2)].map((_, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`dot ${activeCardIndex === idx ? 'active' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); setActiveCardIndex(idx); }}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {userData?.special_permission && (
                                    <section className="teacher-action-grid-section">
                                        <div
                                            className="teacher-action-flashcard-small"
                                            title="Transport"
                                            aria-label="Open transport"
                                            onClick={() => navigate('/teacher-dashboard/transport')}
                                        >
                                            <div className="teacher-action-icon-wrap">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <rect x="1" y="3" width="22" height="13" rx="2" ry="2" />
                                                    <path d="M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                                                    <path d="M17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                                                    <path d="M15 13H9m6-4H9m6-4H9" />
                                                </svg>
                                            </div>
                                        </div>
                                    </section>
                                )}

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
                            </div>
                        } />
                        <Route path="/students" element={<div className="standard-padded-content"><TeacherStudents /></div>} />
                        <Route path="/routine" element={<div className="standard-padded-content"><Routine /></div>} />
                        <Route path="/attendance" element={<div className="standard-padded-content"><Attendance /></div>} />
                        <Route path="/attendance/:class/:section" element={<div className="standard-padded-content"><TakeAttendance /></div>} />
                        <Route path="/stats" element={<div className="standard-padded-content"><Stats /></div>} />
                        <Route path="/admit-card" element={<div className="standard-padded-content"><AdmitCard /></div>} />
                        <Route path="/id-card" element={<div className="standard-padded-content"><IDCardView userData={userData} /></div>} />
                        
                        {/* Result Flow: Container Free */}
                        <Route path="/results" element={<ResultDashboard />} />
                        <Route path="/results/create" element={<CreateExam />} />
                        <Route path="/results/:id" element={<DataEntryGrid />} />
                        <Route path="/results/:examId/view/:studentId" element={<ReportCardPage />} />

                        <Route path="/transport" element={<div className="standard-padded-content"><Transport /></div>} />
                        <Route path="/transport/live/:id" element={<div className="standard-padded-content"><LiveTracking /></div>} />
                        {userData?.special_permission && (
                            <>
                                <Route path="/fees" element={<div className="standard-padded-content"><Fees /></div>} />
                                <Route path="/transport/route/:id" element={<div className="standard-padded-content"><RouteManagement /></div>} />
                            </>
                        )}
                        <Route path="*" element={<div className="standard-padded-content"><div className="no-items-placeholder"><h3>Coming Soon</h3><p>This module is under development.</p></div></div>} />
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
