import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import socket, { joinInstituteRoom } from '../socket';
import './PrincipalDashboard.css';
import PrincipalProfileModal from '../components/PrincipalProfileModal';
import Students from './Students';
import Teachers from './Teachers';
import DashboardOverview from './DashboardOverview';
import Attendance from './Attendance';
import TakeAttendance from './TakeAttendance';
import SubscriptionPage from './SubscriptionPage';
import Fees from './Fees';
import Routine from './Routine';
import AdmitCard from './AdmitCard';
import IDCardView from './IDCardView';
import ResultDashboard from './ResultManagement/ResultDashboard';
import CreateExam from './ResultManagement/CreateExam';
import DataEntryGrid from './ResultManagement/DataEntryGrid';
import ReportCardPage from './ResultManagement/ReportCardPage';
import { useTheme } from '../context/ThemeContext';

const PrincipalDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // State Management
    const [subStatus, setSubStatus] = useState('active');
    const [subData, setSubData] = useState(null);
    const [isLoadingSub, setIsLoadingSub] = useState(true);
    const [userData, setUserData] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const profilePopupRef = useRef(null);

    // Handle Click Outside Profile Popup
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profilePopupRef.current && !profilePopupRef.current.contains(event.target)) {
                setShowProfilePopup(false);
            }
        };

        if (showProfilePopup) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showProfilePopup]);

    // Load User Data
    const loadUserData = async () => {
        try {
            const storedData = localStorage.getItem('userData');
            const token = localStorage.getItem('token');

            if (!storedData || !token) {
                navigate('/');
                return;
            }

            const parsedData = JSON.parse(storedData);
            setUserData(parsedData);
            setProfileData(parsedData);

            // Verify if user is principal
            const userType = localStorage.getItem('userType');
            if (userType !== 'principal') {
                navigate('/');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            navigate('/');
        }
    };

    useEffect(() => {
        document.title = "Principal Dashboard | Klassin";
        loadUserData();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfileData(response.data.profile);
            setUserData(response.data.profile);
            localStorage.setItem('userData', JSON.stringify(response.data.profile));
        } catch (error) {
            console.error('Fetch profile error:', error);
        }
    };

    useEffect(() => {
        if (userData?.id) {
            checkSubscription(userData.id);
            joinInstituteRoom(userData.id);
            fetchProfile();
        }

        // Re-join on reconnect
        socket.on('connect', () => {
            if (userData?.id) joinInstituteRoom(userData.id);
        });

        // Listen for real-time subscription updates
        socket.on('subscription_update', (data) => {
            console.log('Real-time sub update:', data);
            setSubStatus(data.status);
            if (data.settings) {
                setSubData(prev => ({ ...prev, ...data.settings, status: data.status }));
            }

            if (data.status === 'disabled') {
                toast.error('Your institute access has been revoked by the administrator.');
            } else if (data.status === 'active') {
                toast.success('Your subscription is now Active!');
            } else if (data.status === 'grant') {
                toast.success('Special Access Granted by Admin!');
            } else if (data.status === 'expired') {
                toast.warning('Subscription Expired.');
            }
        });

        return () => {
            socket.off('connect');
            socket.off('subscription_update');
        };
    }, [userData]);

    const checkSubscription = async (instituteId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Status response includes ss.* and calculated status
            setSubStatus(response.data.status);
            setSubData(response.data);

            // If disabled/expired, confirm we are not on permitted pages
            const status = response.data.status;
            if (status === 'disabled' || status === 'expired') {
                if (location.pathname !== '/dashboard/subscription' && location.pathname !== '/dashboard') {
                    // Optional: redirect to subscription immediately?
                    // navigate('/dashboard/subscription'); // Let's not force redirect abruptly, just show locks
                }
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
        } finally {
            setIsLoadingSub(false);
        }
    };

    // Auto-check for expiry based on current data
    useEffect(() => {
        // If status is 'grant', we skip date checks because Admin overrode it.
        if (subStatus === 'grant') return;

        if (!subData?.subscription_end_date || subStatus !== 'active') return;

        const checkExpiry = () => {
            const expiry = new Date(subData.subscription_end_date);
            const now = new Date();
            if (now >= expiry) {
                console.log('Subscription expired locally. Locking dashboard.');
                setSubStatus('expired');
                setSubData(prev => ({ ...prev, status: 'expired' }));
                toast.warning('Your subscription has just expired.');
            }
        };

        const timer = setInterval(checkExpiry, 1000);
        return () => clearInterval(timer);
    }, [subData, subStatus]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('instituteId');
        localStorage.removeItem('userType');
        navigate('/');
    };

    const handleProfileUpdate = (updatedData) => {
        const newUserData = { ...userData, ...updatedData };
        setUserData(newUserData);
        setProfileData(newUserData);
        localStorage.setItem('userData', JSON.stringify(newUserData));
    };

    const isLocked = subStatus === 'expired' || subStatus === 'disabled';

    // Define what is allowed when locked
    const allowedPaths = ['/dashboard', '/dashboard/subscription'];

    const handleNavClick = (path) => {
        if (isLocked && path !== '/dashboard/subscription') {
            toast.warning(subStatus === 'disabled'
                ? 'Institute account disabled. Please contact admin.'
                : 'Subscription expired. Redirecting to billing...');
            navigate('/dashboard/subscription');
        } else {
            navigate(path);
        }
        if (window.innerWidth <= 1024) {
            setIsSidebarOpen(false);
        }
    };

    const navigationItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> },
        { name: 'Students', path: '/dashboard/students', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
        { name: 'Teachers', path: '/dashboard/teachers', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></svg> },
        { name: 'Attendance', path: '/dashboard/attendance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
        { name: 'Fees', path: '/dashboard/fees', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg> },
        { name: 'Transport', path: '/dashboard/transport', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M4 11V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5" /></svg> },
        { name: 'Certificates', path: '/dashboard/certificates', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg> },
        { name: 'Admit Card', path: '/dashboard/admit-card', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg> },
        { name: 'Identity Card', path: '/dashboard/id-card', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
        { name: 'Results', path: '/dashboard/results', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
        { name: 'Routine', path: '/dashboard/routine', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
        { name: 'Subscription', path: '/dashboard/subscription', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg> }
    ];

    return (
        <div className={`principal-dashboard theme-${theme} ${isSidebarOpen ? 'sidebar-visible' : ''}`}>
            {/* Transparent Overlay to handle clicking outside to close */}
            {isSidebarOpen && (
                <div
                    className="sidebar-overlay-transparent"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            {/* Navigation Sidebar */}
            <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo-group">
                        <div className="sidebar-logo">
                            {profileData?.logo_url ? <img src={profileData.logo_url} alt="Logo" /> : <span>{userData?.institute_name?.charAt(0)}</span>}
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navigationItems.map(item => {
                        const locked = isLocked && !allowedPaths.includes(item.path);
                        return (
                            <button
                                key={item.path}
                                className={`sidebar-nav-btn ${location.pathname === item.path ? 'active' : ''} ${locked ? 'locked' : ''}`}
                                onClick={() => handleNavClick(item.path)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span className="nav-text">{item.name}</span>
                                {locked && (
                                    <span className="lock-icon">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content Area */}
            < div className="dashboard-main-container" >
                <header className="dashboard-header-modern">
                    <div className="header-left-group">
                        {!isSidebarOpen && (
                            <button
                                className={`menu-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                aria-label="Toggle Menu"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="header-center-group">
                        <div className="inst-meta">
                            <div className="inst-logo-modern">
                                {profileData?.logo_url ? <img src={profileData.logo_url} alt="Logo" /> : <span>{userData?.institute_name?.charAt(0)}</span>}
                            </div>
                            <h1 className="inst-name-modern uppercase">{(userData?.institute_name || '').toUpperCase()}</h1>
                        </div>
                    </div>

                    <div className="header-right-group">
                        <div className="header-profile-trigger" ref={profilePopupRef}>
                            <img
                                src={profileData?.principal_photo_url || 'https://via.placeholder.com/40'}
                                alt="Profile"
                                className="header-avatar"
                                onClick={() => setShowProfilePopup(!showProfilePopup)}
                            />
                            {showProfilePopup && (
                                <div className="profile-popup">
                                    <div className="popup-header-premium">
                                        <div className="popup-user-details">
                                            <h3>{userData?.principal_name}</h3>
                                            <span className="badge-principal">Principal</span>
                                            <div className="popup-quick-contact">
                                                <div className="quick-row">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                                    <span>{userData?.email}</span>
                                                </div>
                                                <div className="quick-row">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                    <span>{userData?.mobile}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="popup-divider"></div>
                                    <div className="popup-menu">
                                        <button className="popup-item" onClick={() => { setShowProfileModal(true); setShowProfilePopup(false); }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                            My Profile
                                        </button>
                                        <button className="popup-item" onClick={() => navigate('/dashboard/subscription')}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                                            Subscription
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
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="dashboard-view-content">
                    {/* Locked View for Overview */}
                    {isLocked && location.pathname === '/dashboard' ? (
                        <div className="dashboard-locked-overlay">
                            <div className="locked-card">
                                <div className="locked-icon-pulse">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                                <h2>Access restricted</h2>
                                <p>
                                    {subStatus === 'disabled'
                                        ? 'Your institute account has been disabled by the administrator. Please contact support to restore access.'
                                        : 'Your subscription has expired. Please renew your plan to continue using the ERP features.'}
                                </p>
                                <button className="go-to-sub-btn" onClick={() => navigate('/dashboard/subscription')}>
                                    Go to Subscription Management
                                </button>
                            </div>
                        </div>
                    ) : (
                        <Routes>
                            <Route path="/" element={<DashboardOverview userData={userData} profileData={profileData} subData={subData} />} />
                            <Route path="/students" element={<Students />} />
                            <Route path="/teachers" element={<Teachers />} />
                            <Route path="/attendance" element={<Attendance />} />
                            <Route path="/attendance/:class/:section" element={<TakeAttendance />} />
                            <Route path="/subscription" element={<SubscriptionPage />} />
                            <Route path="/fees" element={<Fees />} />
                            <Route path="/routine" element={<Routine />} />
                            <Route path="/admit-card" element={<AdmitCard />} />
                            <Route path="/id-card" element={<IDCardView userData={userData} />} />
                            <Route path="/results" element={<ResultDashboard />} />
                            <Route path="/results/create" element={<CreateExam />} />
                            <Route path="/results/:id" element={<DataEntryGrid />} />
                            <Route path="/results/:examId/view/:studentId" element={<ReportCardPage />} />
                            <Route path="*" element={<div className="coming-soon-card"><h3>Feature Coming Soon</h3><p>We're working hard to bring this feature to you.</p></div>} />
                        </Routes>
                    )}
                </main>
            </div >

            <PrincipalProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                profileData={profileData}
                onUpdate={handleProfileUpdate}
            />
        </div >
    );
};

export default PrincipalDashboard;
