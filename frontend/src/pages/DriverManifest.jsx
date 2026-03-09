import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { getISTDate } from '../utils/dateFormatter';
import './DriverManifest.css';

const DriverManifest = () => {
    const { id } = useParams();
    const [bus, setBus] = useState(null);
    const [stops, setStops] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pickup');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [tripStatus, setTripStatus] = useState('pending'); // pending, started, completed

    const todayDate = getISTDate();

    useEffect(() => {
        fetchManifest();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [id, activeTab]);

    const fetchManifest = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/public/manifest/${id}`, {
                params: { date: todayDate, type: activeTab }
            });
            setBus(response.data.bus);
            setStops(response.data.stops);
            setAssignments(response.data.assignments);
            fetchDailyLogs();
        } catch (error) {
            console.error('Error fetching manifest:', error);
            toast.error('Manifest not found');
        } finally {
            setLoading(false);
        }
    };

    const fetchDailyLogs = async () => {
        try {
            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/public/logs-mini/${id}`, {
                params: { date: todayDate, type: activeTab }
            });
            setLogs(response.data.logs || []);
            setTripStatus(response.data.tripStatus || 'pending');
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const handleTripAction = async (newStatus) => {
        try {
            await axios.post(`${API_ENDPOINTS.TRANSPORT}/public/trip-status/${id}`, {
                status: newStatus,
                date: todayDate,
                type: activeTab
            });
            setTripStatus(newStatus);
            toast.success(newStatus === 'started' ? 'Trip Started!' : 'Trip Completed');
        } catch (error) {
            toast.error('Failed to update trip status');
        }
    };

    const handleMarkStatus = async (studentId, stopId, currentStatus) => {
        if (tripStatus !== 'started') {
            return toast.warning('Please START TRIP first');
        }
        const newStatus = currentStatus === 'boarded' ? 'pending' : 'boarded';
        
        try {
            await axios.post(`${API_ENDPOINTS.TRANSPORT}/public/mark-status/${id}`, {
                studentId,
                stopId,
                type: activeTab,
                status: newStatus,
                date: todayDate
            });
            
            if (newStatus === 'boarded') {
                setLogs([...logs, { student_id: studentId, status: 'boarded', stop_id: stopId }]);
            } else {
                setLogs(logs.filter(l => l.student_id !== studentId));
            }
            
            toast.success(newStatus === 'boarded' ? 'Marked' : 'Reset');
        } catch (error) {
            toast.error('Failed');
        }
    };

    if (loading) return <div className="driver-loading">Loading Manifest...</div>;

    const driverMobile = bus?.driver_mobile || 'N/A';
    const conductor = bus?.staff?.find(s => s.role.toLowerCase().includes('conductor'));

    return (
        <div className="driver-manifest-wrapper">
            <div className="driver-manifest-page">
                <header className="driver-header-premium">
                    <div className="driver-header-top">
                        <div className="live-badge">LIVE SESSION</div>
                        <div className="digital-clock">
                            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    
                    <div className="bus-staff-banner">
                        <div className="staff-main-info">
                            <span className="staff-label">PRIMARY DRIVER</span>
                            <h3>{bus?.driver_name}</h3>
                            <p className="staff-mobile">📞 {driverMobile}</p>
                        </div>
                        <div className="staff-main-info">
                            <span className="staff-label">CONDUCTOR</span>
                            <h3>{conductor?.name || 'Not Assigned'}</h3>
                            <p className="staff-mobile">📞 {conductor?.mobile || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="trip-control-section">
                        {tripStatus === 'pending' ? (
                            <button className="trip-btn start" onClick={() => handleTripAction('started')}>
                                START TRIP
                            </button>
                        ) : tripStatus === 'started' ? (
                            <button className="trip-btn stop" onClick={() => handleTripAction('completed')}>
                                END TRIP
                            </button>
                        ) : (
                            <div className="trip-completed-badge">TRIP COMPLETED</div>
                        )}
                    </div>

                    <div className="bus-hero-info">
                        <h1>Bus: {bus?.bus_number}</h1>
                        <div className="route-path-visual-compact">
                            <span>{bus?.start_point}</span>
                            <div className="arrow-line"></div>
                            <span>{bus?.end_point}</span>
                        </div>
                    </div>
                </header>

                <div className="driver-tabs">
                    <button className={`d-tab ${activeTab === 'pickup' ? 'active' : ''}`} onClick={() => setActiveTab('pickup')}>
                        <span className="d-tab-primary">PICKUP</span>
                        <span className="d-tab-secondary">Home to School</span>
                    </button>
                    <button className={`d-tab ${activeTab === 'drop' ? 'active' : ''}`} onClick={() => setActiveTab('drop')}>
                        <span className="d-tab-primary">DROP</span>
                        <span className="d-tab-secondary">School to Home</span>
                    </button>
                </div>

                <div className="driver-stops-scroll">
                    {stops.map((stop, idx) => {
                        const stopStudents = assignments.filter(a => a.stop_id === stop.id);
                        const markedCount = logs.filter(l => l.stop_id === stop.id && l.status === 'boarded').length;
                        const isStopComplete = stopStudents.length > 0 && markedCount === stopStudents.length;

                        return (
                            <div key={stop.id} className={`driver-stop-section ${isStopComplete ? 'completed' : ''}`}>
                                <div className="d-stop-header">
                                    <span className="d-stop-index">{idx + 1}</span>
                                    <div className="d-stop-title-group">
                                        <h3>{stop.stop_name}</h3>
                                        <div className="d-stop-stats">
                                            {markedCount}/{stopStudents.length} Students Marked
                                        </div>
                                    </div>
                                    {isStopComplete && <div className="complete-check">✓</div>}
                                </div>
                                
                                <div className="d-students-list">
                                    {stopStudents.map(student => {
                                        const isMarked = logs.some(l => l.student_id === student.student_id && l.status === 'boarded');
                                        return (
                                            <div key={student.student_id} className={`d-student-row ${isMarked ? 'marked' : ''}`}>
                                                <div className="d-student-info">
                                                    <img src={student.photo_url || 'https://via.placeholder.com/40'} alt="" />
                                                    <div className="d-meta">
                                                        <p className="d-name">{student.student_name}</p>
                                                        <p className="d-sub">Class {student.class}-{student.section}</p>
                                                    </div>
                                                </div>
                                                <button 
                                                    className={`mark-btn-modern ${isMarked ? 'marked' : ''}`}
                                                    onClick={() => handleMarkStatus(student.student_id, stop.id, isMarked ? 'boarded' : 'pending')}
                                                >
                                                    {isMarked ? 'DONE' : 'MARK'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DriverManifest;
