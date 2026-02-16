import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config';
import socket, { joinAdminRoom } from '../socket';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [institutes, setInstitutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        document.title = "Admin Portal | Klassin";
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');

        if (!token || userType !== 'admin') {
            navigate('/');
            return;
        }

        fetchInstitutes();
        joinAdminRoom();

        // Listen for payments
        socket.on('payment_received', (data) => {
            console.log('Real-time payment notification:', data);
            toast.info(`Payment of ₹${data.amount} received from Institute ID: ${data.instituteId}`);

            // Update the local list state
            setInstitutes(prev => prev.map(inst => {
                if (parseInt(inst.id) === parseInt(data.instituteId)) {
                    return {
                        ...inst,
                        current_status: 'Active',
                        subscription_end_date: data.subscription_end_date
                    };
                }
                return inst;
            }));
        });

        return () => {
            socket.off('payment_received');
        };
    }, [navigate]);

    const fetchInstitutes = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ADMIN_DASHBOARD}/institutes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstitutes(response.data);
        } catch (error) {
            console.error('Error fetching institutes:', error);
            setError('Failed to load institutes. Please check server connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = (id) => {
        navigate(`/admin/institute/${id}`);
    };

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatIndianDate = (date) => {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    };

    const formatIndianTime = (date) => {
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Active': return 'active';
            case 'Inactive': return 'inactive';
            case 'Expired': return 'expired';
            case 'Disabled': return 'disabled';
            default: return 'inactive';
        }
    };

    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        localStorage.removeItem('userType');
        navigate('/');
    };

    if (loading) return (
        <div className="admin-loading-container">
            <div className="admin-loader"></div>
            <p>Loading Admin Portal...</p>
        </div>
    );

    return (
        <div className="admin-dashboard">
            <div className="admin-glass-header">
                <div className="header-left">
                    <div className="admin-logo-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h1>Admin Portal</h1>
                </div>
                <div className="header-right">
                    <div className="time-display">
                        <span className="current-time">{formatIndianTime(currentTime)}</span>
                        <span className="current-date">{formatIndianDate(currentTime)}</span>
                    </div>
                    <div className="admin-profile-container" style={{ position: 'relative' }}>
                        <div
                            className="admin-profile-icon"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            style={{ cursor: 'pointer' }}
                            title="Click for options"
                        >
                            <div className="avatar-circle">A</div>
                        </div>
                        {showProfileMenu && (
                            <div className="admin-dropdown-menu" style={{
                                position: 'absolute',
                                top: '120%',
                                right: '0',
                                background: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                padding: '8px',
                                width: '150px',
                                zIndex: 1000,
                                border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: '#fff0f0',
                                        color: '#ef4444',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '500',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="admin-content-wrapper">
                <div className="dashboard-controls">
                    <div className="filter-bar">
                        <div className="search-wrapper">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input type="text" placeholder="Search institutes..." />
                        </div>
                        <button className="filter-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                            </svg>
                            Filters
                        </button>
                    </div>
                </div>

                <div className="content-scroll-area">
                    <div className="section-title">
                        <h2>Registered Institutes</h2>
                        <span className="count-badge">{institutes.length} Total</span>
                    </div>

                    {error && <div className="admin-error-message">{error}</div>}
                    {!loading && !error && institutes.length === 0 && <div className="no-institutes-message">No institutes found.</div>}

                    <div className="institutes-grid">
                        {institutes.map((inst) => (
                            <div key={inst.id} className="institute-card" onClick={() => handleCardClick(inst.id)}>
                                <div className="card-header">
                                    <div className="inst-header-left">
                                        <div className="inst-logo">
                                            {inst.logo_url ? (
                                                <img src={inst.logo_url} alt="Logo" />
                                            ) : (
                                                <div className="placeholder-logo">{(inst.institute_name || '?').charAt(0)}</div>
                                            )}
                                        </div>
                                        <div className="inst-titles">
                                            <h3>{inst.institute_name}</h3>
                                            {(() => {
                                                // Dynamic Status Calculation
                                                let displayStatus = inst.current_status;
                                                const expiryDate = inst.subscription_end_date ? new Date(inst.subscription_end_date) : null;

                                                if (displayStatus === 'Active' && expiryDate && currentTime >= expiryDate) {
                                                    displayStatus = 'Expired';
                                                }

                                                return (
                                                    <span className={`status-badge ${getStatusClass(displayStatus)}`}>
                                                        {displayStatus === 'Active' ? `Expires: ${expiryDate.toLocaleString('en-IN', {
                                                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                                        })}` : displayStatus}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="principal-preview">
                                        <div className="principal-avatar">
                                            {inst.principal_photo_url ? (
                                                <img src={inst.principal_photo_url} alt="Principal" />
                                            ) : (
                                                <div className="placeholder-avatar">{(inst.principal_name || '?').charAt(0)}</div>
                                            )}
                                        </div>
                                        <div className="principal-info">
                                            <span className="label">Principal</span>
                                            <span className="name">{inst.principal_name}</span>
                                        </div>
                                    </div>

                                    <div className="card-stats-row">
                                        <div className="mini-stat">
                                            <span className="mini-value">{inst.student_count || 0}</span>
                                            <span className="mini-label">Students</span>
                                        </div>
                                        <div className="mini-stat">
                                            <span className="mini-value">{inst.teacher_count || 0}</span>
                                            <span className="mini-label">Teachers</span>
                                        </div>
                                    </div>

                                    <div className="location-info">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span>{inst.city || inst.district || 'Location N/A'}, {inst.state || ''}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
