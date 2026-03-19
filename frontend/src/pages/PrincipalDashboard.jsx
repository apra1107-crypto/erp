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
import Stats from './Stats';
import Routine from './Routine';
import AdmitCard from './AdmitCard';
import IDCardView from './IDCardView';
import Fees from './Fees';
import Transport from './Transport';
import RouteManagement from './RouteManagement';
import LiveTracking from './LiveTracking';
import HomeworkHub from './HomeworkHub';
import ClassHomework from './ClassHomework';
import ResultDashboard from './ResultManagement/ResultDashboard';
import CreateExam from './ResultManagement/CreateExam';
import DataEntryGrid from './ResultManagement/DataEntryGrid';
import ReportCardPage from './ResultManagement/ReportCardPage';
import { useTheme } from '../context/ThemeContext';

// Import Icons
import studentIcon from '../assets/icons/student.png';
import dashboardIcon from '../assets/icons/layout.png';
import teacherIcon from '../assets/icons/teacher.png';
import attendanceIcon from '../assets/icons/attendance.png';
import admitCardIcon from '../assets/icons/id-card (1).png';
import idCardIcon from '../assets/icons/id-card.png';
import feesIcon from '../assets/icons/rupee.png';
import resultsIcon from '../assets/icons/results.png';
import subscriptionIcon from '../assets/icons/cash-payment.png';
import statsIcon from '../assets/icons/statistics.png';
import transportIcon from '../assets/icons/school-bus.png';

const PrincipalDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // State Management
    const [subStatus, setSubStatus] = useState('loading');
    const [subData, setSubData] = useState(null);
    const [isLoadingSub, setIsLoadingSub] = useState(true);
    const [userData, setUserData] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showMobileSessionList, setShowMobileSessionList] = useState(false);
    
    // Session States
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [isAddingSession, setIsAddingSession] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');
    const [editingSessionId, setEditingSessionId] = useState(null);

    const { theme, toggleTheme } = useTheme();
    const profilePopupRef = useRef(null);
    const sidebarRef = useRef(null);

    const fetchSessions = async () => {
        try {
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const headers = { Authorization: `Bearer ${token}` };
            if (storedSessionId) headers['x-academic-session-id'] = storedSessionId;

            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, { headers });
            setSessions(response.data);
            if (storedSessionId) {
                setSelectedSessionId(Number(storedSessionId));
            } else {
                const active = response.data.find(s => s.is_active);
                if (active) {
                    setSelectedSessionId(active.id);
                    localStorage.setItem('selectedSessionId', active.id);
                }
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };

    const handleAddSession = async () => {
        if (!newSessionName.trim()) return;
        try {
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const headers = { Authorization: `Bearer ${token}` };
            if (storedSessionId) headers['x-academic-session-id'] = storedSessionId;

            await axios.post(API_ENDPOINTS.ACADEMIC_SESSIONS, { name: newSessionName }, { headers });
            setNewSessionName('');
            setIsAddingSession(false);
            fetchSessions();
            toast.success('New session added successfully');
        } catch (error) {
            toast.error('Failed to add session');
        }
    };

    const handleUpdateSession = async (id, name, isActive = false) => {
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_ENDPOINTS.ACADEMIC_SESSIONS}/${id}`, { name, is_active: isActive }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': id.toString()
                }
            });
            localStorage.setItem('selectedSessionId', id);
            setSelectedSessionId(id);
            setEditingSessionId(null);
            toast.success('Session updated');
            window.location.reload(); // Reload to refresh all data with new session header
        } catch (error) {
            toast.error('Failed to update session');
        }
    };

    const handleDeleteSession = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete session "${name}"?`)) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.ACADEMIC_SESSIONS}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchSessions();
            toast.success('Session deleted');
        } catch (error) {
            toast.error('Failed to delete session');
        }
    };
    
    // Refs to avoid stale closures in socket listener
    const subStatusRef = useRef(subStatus);
    const locationRef = useRef(location);

    useEffect(() => {
        subStatusRef.current = subStatus;
        locationRef.current = location;
    }, [subStatus, location]);

    // Handle Click Outside Sidebar to Collapse
    // Handle Click Outside Sidebar to Collapse
    useEffect(() => {
        const handleClickOutsideSidebar = (event) => {
            if (!isCollapsed && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsCollapsed(true);
            }
        };

        document.addEventListener('mousedown', handleClickOutsideSidebar);
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideSidebar);
        };
    }, [isCollapsed]);

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
                return;
            }

            // Fetch latest data once we have the ID from storage
            if (parsedData.id) {
                checkSubscription(parsedData.id);
                joinInstituteRoom(parsedData.id);
                fetchProfile();
                fetchSessions();
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
        console.log("DEBUG: Fetching Principal Profile...");
        try {
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const headers = { Authorization: `Bearer ${token}` };
            if (storedSessionId) headers['x-academic-session-id'] = storedSessionId;

            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, { headers });
            console.log("DEBUG: Profile response received");
            setProfileData(response.data.profile);
            // DO NOT call setUserData(response.data.profile) here if it triggers an effect
            // Instead, just update storage and profileData
            localStorage.setItem('userData', JSON.stringify(response.data.profile));
        } catch (error) {
            console.error('DEBUG: Fetch profile error:', error);
        }
    };

    useEffect(() => {
        if (!userData?.id) return;

        const handleJoinRoom = () => {
            console.log("DEBUG: Joining institute room:", userData.id);
            joinInstituteRoom(userData.id);
        };

        if (socket.connected) handleJoinRoom();
        socket.on('connect', handleJoinRoom);

        socket.on('subscription_update', (data) => {
            console.log('Real-time sync received:', data);
            if (data.status) {
                const currentStatus = subStatusRef.current;
                const wasLocked = currentStatus === 'expired' || currentStatus === 'disabled' || currentStatus === 'loading';
                const isNowLocked = data.status === 'expired' || data.status === 'disabled';
                
                // Update State
                setSubStatus(data.status);
                if (data.settings) {
                    setSubData(prev => ({ ...prev, ...data.settings, status: data.status }));
                }

                // Immediate Transitions & Feedback
                if (wasLocked && !isNowLocked) {
                    toast.success(data.status === 'grant' ? 'Special Access Granted!' : 'Subscription Activated!');
                    // Redirect if on restricted view
                    const currentPath = locationRef.current.pathname;
                    if (currentPath === '/dashboard/subscription' || currentPath === '/dashboard') {
                        navigate('/dashboard');
                    }
                } else if (!wasLocked && isNowLocked) {
                    toast.warning(data.status === 'disabled' ? 'Account Disabled by Admin' : 'Subscription Expired');
                    // Only redirect if NOT on an already allowed path (like the dashboard)
                    if (!allowedPaths.includes(locationRef.current.pathname)) {
                        navigate('/dashboard/subscription');
                    }
                } else if (data.status === 'grant' && currentStatus === 'active') {
                    toast.info('Switched to Special Access mode');
                } else if (data.status === 'active' && currentStatus === 'grant') {
                    toast.success('Subscription plan is now active');
                }
            }
        });

        return () => {
            socket.off('connect', handleJoinRoom);
            socket.off('subscription_update');
        };
    }, [userData?.id]);

    const checkSubscription = async (instId) => {
        const idToUse = instId || userData?.id || localStorage.getItem('instituteId');
        if (!idToUse) {
            setIsLoadingSub(false);
            return;
        }
        console.log("DEBUG: Force Refreshing Subscription for:", idToUse);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${idToUse}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("DEBUG: Refresh response:", response.data.status);
            setSubStatus(response.data.status);
            setSubData(response.data);
            return response.data;
        } catch (error) {
            console.error('DEBUG: Error checking subscription:', error);
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

    const isLocked = subStatus === 'expired' || subStatus === 'disabled' || subStatus === 'loading';

    // Define what is allowed when locked
    const allowedPaths = ['/dashboard', '/dashboard/subscription'];

    const handleNavClick = (path) => {
        if (isLocked && !allowedPaths.includes(path)) {
            toast.warning(subStatus === 'disabled'
                ? 'Institute account disabled. Please contact admin.'
                : 'Subscription expired. Please renew to access this feature.');
            if (location.pathname !== '/dashboard/subscription') {
                navigate('/dashboard/subscription');
            }
        } else {
            navigate(path);
        }
    };

    const navigationItems = [
        { name: 'Dashboard', path: '/dashboard', color: '#3b82f6', icon: dashboardIcon },
        { name: 'Students', path: '/dashboard/students', color: '#10b981', icon: studentIcon },
        { name: 'Subscription', path: '/dashboard/subscription', color: '#f59e0b', icon: subscriptionIcon },
        { name: 'Teachers', path: '/dashboard/teachers', color: '#f59e0b', icon: teacherIcon },
        { name: 'Attendance', path: '/dashboard/attendance', color: '#8b5cf6', icon: attendanceIcon },
        { name: 'Transport', path: '/dashboard/transport', color: '#06b6d4', icon: transportIcon },
        { name: 'Admit Card', path: '/dashboard/admit-card', color: '#f97316', icon: admitCardIcon },
        { name: 'Identity Card', path: '/dashboard/id-card', color: '#6366f1', icon: idCardIcon },
        { name: 'Fees', path: '/dashboard/fees', color: '#10b981', icon: feesIcon },
        { name: 'Results', path: '/dashboard/results', color: '#ef4444', icon: resultsIcon },
        { name: 'Routine', path: '/dashboard/routine', color: '#8b5cf6', icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png" },
        { name: 'Stats', path: '/dashboard/stats', color: '#10b981', icon: statsIcon }
    ];

    return (
        <div className={`principal-dashboard theme-${theme} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Navigation Sidebar */}
            <aside ref={sidebarRef} className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header-spacer"></div>
                <nav className="sidebar-nav">
                    {navigationItems.map(item => {
                        const locked = isLocked && !allowedPaths.includes(item.path);
                        return (
                            <button
                                key={item.path}
                                className={`sidebar-nav-btn ${location.pathname === item.path ? 'active' : ''} ${locked ? 'locked' : ''}`}
                                onClick={() => handleNavClick(item.path)}
                                title={isCollapsed ? item.name : ''}
                                style={{ '--accent-color': item.color }}
                            >
                                <span className="nav-icon">
                                    <img src={item.icon} alt={item.name} className="sidebar-png-icon" />
                                </span>
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

            {/* Main Content Area */}
            <div className="dashboard-main-container">
                <header className="dashboard-header-modern">
                    <div className="mobile-header-inst-name">
                        {profileData?.logo_url ? (
                            <img src={profileData.logo_url} alt="" style={{ height: '20px', width: 'auto', borderRadius: '4px' }} />
                        ) : (
                            <div style={{ width: '20px', height: '20px', background: '#6366f1', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                {userData?.institute_name?.charAt(0)}
                            </div>
                        )}
                        <span>{(userData?.institute_name || profileData?.institute_name || '').toUpperCase()}</span>
                    </div>
                    <div className="header-left-section">
                        {/* Empty spacer to keep center truly centered */}
                    </div>

                    <div className="header-center-section">
                        <div className="inst-meta-inline-centered">
                            {profileData?.logo_url ? (
                                <img src={profileData.logo_url} alt="Logo" className="inst-logo-raw" />
                            ) : (
                                <div className="inst-logo-placeholder-raw">{userData?.institute_name?.charAt(0)}</div>
                            )}
                            <h1 className="inst-name-raw uppercase">{(userData?.institute_name || '').toUpperCase()}</h1>
                        </div>
                    </div>

                    <div className="header-right-section">
                        <div className="header-profile-trigger-premium" ref={profilePopupRef} onClick={() => setShowProfilePopup(!showProfilePopup)}>
                            <div className="header-user-info-group">
                                <span className="profile-name-text-premium">{userData?.principal_name || 'Principal'}</span>
                                {selectedSessionId && (
                                    <div className="header-session-badge">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                        <span>{sessions.find(s => s.id === selectedSessionId)?.name || 'Session'}</span>
                                    </div>
                                )}
                            </div>
                            <img
                                src={profileData?.principal_photo_url || 'https://via.placeholder.com/40'}
                                alt="Profile"
                                className="header-avatar-premium"
                                onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}
                            />
                            {showProfilePopup && userData && (
                                <div className="profile-popup">
                                    <div className="popup-header-premium">
                                        <div className="popup-user-details">
                                            <h3>{userData?.principal_name || 'Principal'}</h3>
                                            <span className="badge-principal">Principal Account</span>
                                            <div className="popup-quick-contact">
                                                <div className="quick-row">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                                    <span>{userData?.email || 'N/A'}</span>
                                                </div>
                                                <div className="quick-row">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                    <span>{userData?.mobile || 'N/A'}</span>
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

                                        {/* Academic Session Management - Flyout Menu */}
                                        <div 
                                            className={`popup-item has-flyout ${showMobileSessionList ? 'mobile-active' : ''}`}
                                            onClick={(e) => {
                                                if (window.innerWidth <= 768) {
                                                    e.stopPropagation();
                                                    setShowMobileSessionList(!showMobileSessionList);
                                                }
                                            }}
                                        >
                                            <div className="item-content-row">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                                <span>Academic Session</span>
                                                <svg className={`chevron-left-icon ${showMobileSessionList ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                                            </div>

                                            <div className={`session-flyout-menu ${showMobileSessionList ? 'open' : ''}`}>
                                                <div className="flyout-header">
                                                    <span>Switch Session</span>
                                                </div>
                                                <div className="session-list-scrollable">
                                                    {sessions.map(session => (
                                                        <div key={session.id} className={`flyout-session-item ${selectedSessionId === session.id ? 'active' : ''}`}>
                                                            {editingSessionId === session.id ? (
                                                                <div className="session-edit-row">
                                                                    <input 
                                                                        type="text" 
                                                                        value={newSessionName} 
                                                                        onChange={(e) => setNewSessionName(e.target.value)}
                                                                        autoFocus
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateSession(session.id, newSessionName, session.is_active); }}>
                                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="session-view-row" onClick={() => handleUpdateSession(session.id, session.name, true)}>
                                                                    <div className="session-info">
                                                                        <span className="session-name">{session.name}</span>
                                                                        {selectedSessionId === session.id && <div className="active-dot" />}
                                                                    </div>
                                                                    <div className="session-actions">
                                                                        <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setNewSessionName(session.name); }} title="Edit">
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                                        </button>
                                                                        {!session.is_active && (
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id, session.name); }} title="Delete">
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="flyout-footer">
                                                    {isAddingSession ? (
                                                        <div className="session-add-row">
                                                            <input 
                                                                type="text" 
                                                                placeholder="2025-26"
                                                                value={newSessionName}
                                                                onChange={(e) => setNewSessionName(e.target.value)}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <button onClick={(e) => { e.stopPropagation(); handleAddSession(); }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                            </button>
                                                            <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setIsAddingSession(false); }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button className="add-session-inline-btn" onClick={(e) => { e.stopPropagation(); setIsAddingSession(true); }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                            New Session
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

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
                    {/* Locked View for All Restricted Pages */}
                    {isLocked && !allowedPaths.includes(location.pathname) ? (
                        <div className="dashboard-view-content">
                            <div className="dashboard-locked-overlay">
                                <div className="locked-card">
                                    <div className="locked-icon-pulse">
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    </div>
                                    <h2>Access restricted</h2>
                                    <p>
                                        {subStatus === 'loading'
                                            ? 'Verifying subscription status...'
                                            : subStatus === 'disabled'
                                                ? 'Your institute account has been disabled by the administrator. Please contact support to restore access.'
                                                : 'Your subscription has expired. Please renew your plan to continue using the ERP features.'}
                                    </p>
                                    {subStatus !== 'loading' && (
                                        <button className="go-to-sub-btn" onClick={() => navigate('/dashboard/subscription')}>
                                            Go to Subscription Management
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Routes>
                            {/* Result Flow: Container Free */}
                            <Route path="/results" element={<ResultDashboard />} />
                            <Route path="/results/create" element={<CreateExam />} />
                            <Route path="/results/:id" element={<DataEntryGrid />} />
                            <Route path="/results/:examId/view/:studentId" element={<ReportCardPage />} />

                            {/* Standard Content: Padded Container */}
                            <Route path="/" element={<DashboardOverview userData={userData} profileData={profileData} subData={subData} />} />
                            <Route path="/students" element={<Students />} />
                            <Route path="/students/:id" element={<Students />} />
                            <Route path="/Teachers" element={<Teachers />} />
                            <Route path="/teachers/:id" element={<Teachers />} />
                            <Route path="/attendance" element={<Attendance />} />
                            <Route path="/attendance/:class/:section" element={<TakeAttendance />} />
                            <Route path="/subscription" element={<SubscriptionPage onRefreshStatus={checkSubscription} />} />
                            <Route path="/stats" element={<Stats />} />
                            <Route path="/routine" element={<Routine />} />
                            <Route path="/admit-card" element={<AdmitCard />} />
                            <Route path="/id-card" element={<IDCardView userData={userData} />} />
                            <Route path="/fees" element={<Fees />} />
                            <Route path="/transport" element={<Transport />} />
                            <Route path="/transport/route/:id" element={<RouteManagement />} />
                            <Route path="/transport/live/:id" element={<LiveTracking />} />
                            <Route path="/homework" element={<HomeworkHub />} />
                            <Route path="/homework/:className/:section" element={<ClassHomework />} />
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