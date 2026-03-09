import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import { getRemainingTimeText } from '../utils/dateFormatter';

// Import Assets
import studentIcon from '../assets/icons/student.png';
import teacherIcon from '../assets/icons/teacher.png';
import rupeeIcon from '../assets/icons/rupee.png';

const DashboardOverview = ({ userData, profileData, subData }) => {
    const inputRef = useRef(null);
    const navigate = useNavigate();
    const searchRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [activeFlashcard, setActiveFlashcard] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [visuals, setVisuals] = useState({
        percentage: 0,
        progressColor: '#9ca3af',
        label: 'Checking...',
        timeLeftText: 'Checking...',
        isDanger: false
    });

    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isSearchOpen]);

    useEffect(() => {
        fetchDashboardStats();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        const handleClickOutside = (event) => {
            // If click is inside search container OR inside results dropdown, don't close
            if (searchRef.current && searchRef.current.contains(event.target)) {
                return;
            }
            
            // Check if click is on a result item (which might be outside searchRef if using portals, 
            // but here it is inside search-container usually. Let's be safe and check the class)
            if (event.target.closest('.search-results-dropdown')) {
                return;
            }

            setIsSearchOpen(false);
            setSearchResults([]);
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            clearInterval(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/search`, {
                params: { query },
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(response.data.results || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectResult = (item) => {
        console.log("DEBUG: Selected Result:", item);
        setIsSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        if (item.type === 'student') {
            navigate(`/dashboard/students/${item.id}`);
        } else {
            navigate(`/dashboard/teachers/${item.id}`);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const headers = { Authorization: `Bearer ${token}` };
            if (storedSessionId) headers['x-academic-session-id'] = storedSessionId;

            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/stats`, {
                headers
            });
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    };

    // Auto-swap Flashcards every 3 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveFlashcard(prev => (prev + 1) % 3);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const updateVisuals = () => {
            if (!subData) return;

            const today = new Date();
            const currentStatus = subData.status; 
            
            const expiryDate = (currentStatus === 'active' || currentStatus === 'grant')
                ? new Date(subData.subscription_end_date)
                : today;

            const diffMs = expiryDate - today;
            const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

            let percentage = 0;
            let progressColor = '#9ca3af';
            let label = 'Premium Active';
            let timeLeftText = getRemainingTimeText(subData.subscription_end_date);
            let isDanger = false;

            if (currentStatus === 'grant') {
                percentage = 100;
                progressColor = '#8b5cf6'; // Purple
                label = 'Special Access';
                timeLeftText = 'Identity Verified';
            } else if (currentStatus !== 'active' || diffSeconds <= 0) {
                percentage = 100; 
                progressColor = '#94a3b8'; // Slate
                label = 'Expired';
                timeLeftText = 'Access Expired';
            } else {
                const startDate = new Date(subData.subscription_start_date || subData.created_at);
                const totalWindowMs = expiryDate - startDate;
                
                if (totalWindowMs > 0) {
                    percentage = Math.max(0, Math.min(100, (diffMs / totalWindowMs) * 100));
                } else {
                    percentage = 100; 
                }

                if (percentage > 70) {
                    progressColor = '#22d3ee'; // Cyan
                } else if (percentage > 50) {
                    progressColor = '#34d399'; // Emerald
                } else if (percentage > 10) {
                    progressColor = '#fcd34d'; // Amber
                } else if (percentage > 0) {
                    progressColor = '#fb7185'; // Rose
                    isDanger = true;
                }
                label = 'Premium Active';
            }

            setVisuals({ percentage, progressColor, label, timeLeftText, isDanger });
        };

        updateVisuals();
        const timer = setInterval(updateVisuals, 1000);
        return () => clearInterval(timer);
    }, [subData]);

    const { percentage, progressColor } = visuals;

    const isLocked = !subData || subData.status === 'expired' || subData.status === 'disabled' || subData.status === 'loading';

    const renderFlashcards = () => {
        const studentPresent = stats?.attendance?.today?.students?.find(s => s.status === 'present')?.count || 0;
        const studentTotal = stats?.students?.total || 0;
        const teacherPresent = stats?.attendance?.today?.teachers?.find(t => t.status === 'present')?.count || 0;
        const teacherTotal = stats?.teachers?.total || 0;
        
        const monthly = stats?.revenue?.monthly || { expected: 0, collected: 0 };
        const oneTime = stats?.revenue?.oneTime || { expected: 0, collected: 0 };
        const totalExpected = monthly.expected + oneTime.expected;
        const totalCollected = monthly.collected + oneTime.collected;

        const cards = [
            {
                id: 'students',
                title: 'STUDENT ATTENDANCE',
                main: `${studentPresent} / ${studentTotal}`,
                sub: 'Students Present Today',
                /* Modern Dark Premium Gradient: Deep Midnight → Royal Purple → Electric Indigo */
                gradient: 'linear-gradient(135deg, #020617 0%, #312e81 50%, #4338ca 100%)',
                tab: 'students',
                showDateTime: true,
                icon: <img src={studentIcon} alt="Student" className="card-custom-icon" />
            },
            {
                id: 'teachers',
                title: 'TEACHER ATTENDANCE',
                main: `${teacherPresent} / ${teacherTotal}`,
                sub: 'Teachers Present Today',
                gradient: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 50%, #059669 100%)', // Sky to Emerald to Green
                tab: 'teachers',
                showDateTime: true,
                icon: <img src={teacherIcon} alt="Teacher" className="card-custom-icon" />
            },
            {
                id: 'revenue',
                title: 'FINANCIAL OVERVIEW',
                main: `₹${totalCollected.toLocaleString()}`,
                sub: `Expected: ₹${totalExpected.toLocaleString()}`,
                gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #7c3aed 100%)', // Amber to Red to Violet
                tab: 'revenue',
                showDateTime: false,
                icon: <img src={rupeeIcon} alt="Revenue" className="card-custom-icon" />
            }
        ];

        const activeCard = cards[activeFlashcard];

        return (
            <div 
                className={`dashboard-flashcard animate-card ${activeCard.id}-card ${isLocked ? 'locked' : ''}`}
                style={{ background: activeCard.gradient }}
                onClick={() => !isLocked && navigate('/dashboard/stats', { state: { activeTab: activeCard.tab } })}
            >
                <div className="card-glass-overlay"></div>
                <div className="card-shimmer"></div>
                
                {activeCard.showDateTime && (
                    <div className="card-side-clock">
                        <span className="card-date-day-bold">{currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                        <span className="card-time-bold">{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                    </div>
                )}

                <div className="card-top">
                    <div className="card-badge-container">
                        <span className="card-title-tag">{activeCard.title}</span>
                    </div>
                    <div className="card-icon-circle">
                        {activeCard.icon}
                    </div>
                </div>

                <div className="card-body">
                    <div className="card-main-container">
                        <h2 className="card-main-text">{activeCard.main}</h2>
                        {activeCard.id === 'revenue' && (
                            <div className="revenue-progress-wrapper">
                                <div className="revenue-progress-info">
                                    <span className="revenue-percent-text">
                                        {totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}% Collected
                                    </span>
                                </div>
                                <div className="revenue-progress-mini">
                                    <div 
                                        className="revenue-progress-fill" 
                                        style={{ width: `${totalExpected > 0 ? Math.min(100, (totalCollected / totalExpected) * 100) : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="card-sub-text">{activeCard.sub}</p>
                </div>

                <div className="card-bottom-actions">
                    <div className="card-footer-dots">
                        {[0, 1, 2].map(i => (
                            <div key={i} className={`card-dot ${i === activeFlashcard ? 'active' : ''}`} />
                        ))}
                    </div>
                    <div className="card-view-details">
                        <span>VIEW DETAILS</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                </div>

                {isLocked && (
                    <div className="card-lock-overlay">
                        <div className="lock-icon-wrap">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </div>
                        <span>LOCKED</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="overview-container">
            <div className="overview-header-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '2rem' }}>
                
                {/* Left Side: Dynamic Flashcards */}
                {renderFlashcards()}

                {/* Right Side: Professional Subscription Info Card */}
                <div className="subscription-info-card" onClick={() => navigate('/dashboard/subscription')}>
                    <div className="sub-card-header">
                        <span className="sub-status-badge" style={{ color: progressColor }}>{visuals.label}</span>
                        <span className="sub-timer-text">{visuals.timeLeftText}</span>
                    </div>

                    <div className="sub-card-track">
                        <div
                            className={`sub-card-fill ${visuals.isDanger ? 'danger-blink' : ''}`}
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: progressColor
                            }}
                        ></div>
                    </div>

                    <div className="sub-meta-container">
                        <div className="sub-meta-row">
                            <div className="sub-meta-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            </div>
                            <div className="sub-meta-content">
                                <div className="sub-meta-label">
                                    {subData?.status === 'active' || subData?.status === 'grant' ? 'Subscription Expiring on' : 'Subscription Expired on'}
                                </div>
                                <div className="sub-meta-value highlight">
                                    {subData?.subscription_end_date ? new Date(subData.subscription_end_date).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    }) : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="sub-meta-row">
                            <div className="sub-meta-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                            </div>
                            <div className="sub-meta-content">
                                <div className="sub-meta-label">Last Transaction</div>
                                <div className="sub-meta-value">
                                    {subData?.last_action_details ? (
                                        <>
                                            {subData.last_action_details} • {new Date(subData.last_payment_date).toLocaleString('en-IN', {
                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </>
                                    ) : 'No records found'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="action-center-row">
                <div className="action-center-header-group">
                    <div className="action-center-header">
                        <h2>ACTION CENTER</h2>
                    </div>
                    
                    <div className="dashboard-search-wrapper" ref={searchRef}>
                        <div className={`dashboard-search-container ${isSearchOpen ? 'expanded' : ''}`}>
                            <button 
                                className="dashboard-search-trigger-v2" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsSearchOpen(!isSearchOpen);
                                }}
                                title="Search"
                                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', border: 'none' }}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            </button>
                            <input 
                                ref={inputRef}
                                type="text" 
                                placeholder="Search students, teachers..." 
                                value={searchQuery}
                                onChange={handleSearch}
                                onFocus={() => setIsSearchOpen(true)}
                                className="dashboard-search-input"
                            />
                        </div>

                        {isSearchOpen && searchQuery.length > 0 && (
                            <div className="search-results-dropdown">
                                {isSearching ? (
                                    <div className="search-loading">Searching...</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="search-no-results">No matches found for "{searchQuery}"</div>
                                ) : (
                                    searchResults.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className="search-result-item"
                                            onClick={() => handleSelectResult(item)}
                                        >
                                            <div className="result-avatar">
                                                {item.photo_url ? (
                                                    <img src={item.photo_url} alt="" />
                                                ) : (
                                                    <div className="placeholder-icon">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="result-info">
                                                <span className="result-name">{item.name}</span>
                                                <span className="result-meta">
                                                    {item.type === 'student' ? `Class ${item.class}-${item.section}` : `Teacher • ${item.subject}`}
                                                </span>
                                            </div>
                                            <span className={`result-type-tag ${item.type}`}>
                                                {item.type}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="action-grid-horizontal">
                {[
                    { id: 'notice', title: 'Notice', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, color: '#4f46e5', path: '/dashboard/notice' },
                    { id: 'homework', title: 'Homework', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, color: '#d97706', path: '/dashboard/homework' },
                    { id: 'transport', title: 'Transport', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="22" height="13" rx="2" ry="2"/><path d="M7 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M17 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M15 13H9m6-4H9m6-4H9"/></svg>, color: '#0891b2', path: '/dashboard/transport' },
                    { id: 'fees', title: 'Fees', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M16 14v4M12 14v4M8 14v4"/></svg>, color: '#10b981', path: '/dashboard/fees' },
                    { id: 'results', title: 'Results', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, color: '#ef4444', path: '/dashboard/results' },
                    { id: 'attendance', title: 'Attendance', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, color: '#7c3aed', path: '/dashboard/attendance' }
                ].map(action => (
                    <div 
                        key={action.id} 
                        className={`action-flashcard-small ${isLocked ? 'locked' : ''}`}
                        style={{ backgroundColor: action.color }}
                        onClick={() => !isLocked && navigate(action.path)}
                    >
                        <div className="action-icon-wrap">
                            {action.icon}
                        </div>
                        <span className="action-title-text">{action.title}</span>
                        {isLocked && (
                            <div className="action-lock-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DashboardOverview;
