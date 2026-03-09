import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import socket from '../socket';
import { getISTDate } from '../utils/dateFormatter';
import './LiveTracking.css';

const LiveTracking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const userType = localStorage.getItem('userType');
    const dashboardBase = userType === 'teacher' ? '/teacher-dashboard' : '/dashboard';

    // Permission check
    const storedUserData = localStorage.getItem('userData');
    const userData = storedUserData ? JSON.parse(storedUserData) : null;
    const hasFullAccess = userType === 'principal' || (userType === 'teacher' && userData?.special_permission);

    const [bus, setBus] = useState(null);
    const [stops, setStops] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pickup'); 
    const [selectedDate, setSelectedDate] = useState(getISTDate());
    const [expandedStops, setExpandedStops] = useState(new Set());
    const [lastMarkedStopId, setLastMarkedStopId] = useState(null);
    const [tripStatus, setTripStatus] = useState('pending');

    useEffect(() => {
        fetchBusData();
        
        // Join bus room for real-time updates
        socket.emit('join_institute', id); 
        
        const handleStatusUpdate = (data) => {
            if (String(data.busId) === String(id) && data.date === selectedDate && data.type === activeTab) {
                setLogs(prev => {
                    const filtered = prev.filter(l => l.student_id !== data.studentId);
                    if (data.status === 'boarded') {
                        return [...filtered, { 
                            student_id: data.studentId, 
                            status: 'boarded', 
                            stop_id: data.stopId,
                            marked_at: data.marked_at 
                        }];
                    }
                    return filtered;
                });
                
                if (data.status === 'boarded') {
                    setLastMarkedStopId(data.stopId);
                }
            }
        };

        const handleTripUpdate = (data) => {
            if (String(data.busId) === String(id) && data.date === selectedDate && data.type === activeTab) {
                setTripStatus(data.status);
                if (data.status === 'completed') {
                    setLastMarkedStopId(null);
                }
            }
        };

        socket.on('transport_status_update', handleStatusUpdate);
        socket.on('trip_status_update', handleTripUpdate);

        return () => {
            socket.off('transport_status_update', handleStatusUpdate);
            socket.off('trip_status_update', handleTripUpdate);
        };
    }, [id, selectedDate, activeTab]);

    useEffect(() => {
        if (bus) fetchDailyLogs();
    }, [bus, selectedDate, activeTab]);

    const fetchBusData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const selectedBus = response.data.buses.find(b => String(b.id) === String(id));
            if (selectedBus) {
                setBus(selectedBus);
                setStops(selectedBus.stops || []);
                setAssignments(selectedBus.assignments || []);
                setExpandedStops(new Set((selectedBus.stops || []).map(s => s.id)));
            } else {
                toast.error('Bus not found');
                navigate('/dashboard/transport');
            }
        } catch (error) {
            console.error('Error fetching bus data:', error);
            toast.error('Failed to load tracking data');
        } finally {
            setLoading(false);
        }
    };

    const fetchDailyLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/logs/${id}`, {
                params: { date: selectedDate, type: activeTab },
                headers: { Authorization: `Bearer ${token}` }
            });
            const fetchedLogs = response.data.logs || [];
            setLogs(fetchedLogs);
            setTripStatus(response.data.tripStatus || 'pending');
            
            if (fetchedLogs.length > 0 && response.data.tripStatus === 'started') {
                const lastLog = [...fetchedLogs].sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at))[0];
                setLastMarkedStopId(lastLog.stop_id);
            } else {
                setLastMarkedStopId(null);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const toggleStop = (stopId) => {
        const newExpanded = new Set(expandedStops);
        if (newExpanded.has(stopId)) newExpanded.delete(stopId);
        else newExpanded.add(stopId);
        setExpandedStops(newExpanded);
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/driver/manifest/${id}`;
        if (navigator.share) {
            navigator.share({
                title: `Bus Manifest - ${bus.bus_number}`,
                text: `Live Manifest Link for ${bus.driver_name}`,
                url: shareUrl,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!');
        }
    };

    if (loading) return <div className="live-loading">Initializing tracking view...</div>;

    return (
        <div className="live-tracking-page">
            <div className="tracking-top-nav">
                <div className="top-nav-left">
                    <button className="back-btn-minimal" onClick={() => navigate(`${dashboardBase}/transport`)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h2 className="top-nav-title">Route Status</h2>
                </div>
                <div className="date-picker-premium">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </div>
            </div>

            <div className="tracking-control-panel animate-in">
                <div className="route-info-bar">
                    <div className={`status-badge-chip ${tripStatus}`}>
                        {tripStatus.toUpperCase()}
                    </div>
                    <div className="bus-info-inline">
                        <h1>Bus {bus?.bus_number}</h1>
                        <span className="route-separator">•</span>
                        <p>{bus?.start_point} ↔ {bus?.end_point}</p>
                    </div>
                    {hasFullAccess && (
                        <button className="share-manifest-btn" onClick={handleShare}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                            </svg>
                        </button>
                    )}
                </div>

                <div className="tracking-tabs-container">
                    <button className={`modern-tab ${activeTab === 'pickup' ? 'active' : ''}`} onClick={() => setActiveTab('pickup')}>
                        <span className="tab-main">Pickup</span><span className="tab-desc">Home to School</span>
                    </button>
                    <button className={`modern-tab ${activeTab === 'drop' ? 'active' : ''}`} onClick={() => setActiveTab('drop')}>
                        <span className="tab-main">Drop</span><span className="tab-desc">School to Home</span>
                    </button>
                </div>

                <div className="stops-live-list">
                    {stops.map((stop, index) => {
                        const stopStudents = assignments.filter(a => a.stop_id === stop.id);
                        const isExpanded = expandedStops.has(stop.id);
                        const isHighlighted = lastMarkedStopId === stop.id;
                        
                        // Find the last marked time for this stop
                        const stopLogs = logs.filter(l => l.stop_id === stop.id && l.status === 'boarded');
                        const lastMarkedAt = stopLogs.length > 0 
                            ? [...stopLogs].sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at))[0].marked_at 
                            : null;
                        const lastMarkedTimeStr = lastMarkedAt 
                            ? new Date(lastMarkedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
                            : null;

                        return (
                            <div key={stop.id} className={`live-stop-card ${isExpanded ? 'expanded' : ''} ${isHighlighted ? 'active-stop' : ''}`}>
                                <div className="stop-card-header" onClick={() => hasFullAccess && toggleStop(stop.id)}>
                                    <div className="stop-number-badge">{index + 1}</div>
                                    <div className="stop-name-group">
                                        <h3>{stop.stop_name}</h3>
                                        <div className="stop-meta-line">
                                            <span className="student-count-pill">{stopStudents.length} Students</span>
                                            {lastMarkedTimeStr && (
                                                <span className="stop-time-tag">Cleared at {lastMarkedTimeStr}</span>
                                            )}
                                        </div>
                                    </div>
                                    {isHighlighted && <div className="live-marker-dot">● LIVE</div>}
                                    {hasFullAccess && (
                                        <div className="expand-chevron">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}><path d="m6 9 6 6 6-6"/></svg>
                                        </div>
                                    )}
                                </div>

                                {isExpanded && hasFullAccess && (
                                    <div className="stop-students-grid animate-in">
                                        {stopStudents.length > 0 ? (
                                            stopStudents.map(student => {
                                                const log = logs.find(l => l.student_id === student.student_id && l.status === 'boarded');
                                                const isMarked = !!log;
                                                const markedTime = log?.marked_at ? new Date(log.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null;

                                                return (
                                                    <div key={student.student_id} className={`live-student-pill ${isMarked ? 'boarded' : ''}`}>
                                                        <img src={student.photo_url || 'https://via.placeholder.com/40'} alt="" />
                                                        <div className="pill-meta">
                                                            <p className="s-name">{student.student_name}</p>
                                                            <p className="s-info">Class {student.class}-{student.section}</p>
                                                        </div>
                                                        <div className={`status-indicator-group ${isMarked ? 'success' : 'pending'}`}>
                                                            <span className="status-text">
                                                                {isMarked ? (activeTab === 'pickup' ? 'Picked Up' : 'Dropped') : 'Pending'}
                                                            </span>
                                                            {isMarked && markedTime && (
                                                                <span className="marked-time">{markedTime}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : <p className="empty-stop-hint">No students assigned.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LiveTracking;
