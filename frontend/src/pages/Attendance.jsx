import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Attendance.css';

const Attendance = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const rawData = localStorage.getItem('userData');
    const userData = rawData ? JSON.parse(rawData) : null;
    const userType = localStorage.getItem('userType');

    if (!userData) return <div className="attendance-loading"><p>Resolving profile...</p></div>;

    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState({});
    const [studentCounts, setStudentCounts] = useState({});
    
    // Get IST Date correctly (YYYY-MM-DD)
    const getISTDateStr = (date = new Date()) => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    };

    const [selectedDate, setSelectedDate] = useState(getISTDateStr());
    const [markedSections, setMarkedSections] = useState([]);

    const dashboardPath = userType === 'teacher' ? '/teacher-dashboard' : '/dashboard';

    // Calculate time until next midnight IST
    const getTimeUntilMidnight = () => {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const diff = midnight.getTime() - now.getTime();
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return { hours, minutes };
    };

    const [timeRemaining, setTimeRemaining] = useState(getTimeUntilMidnight());

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeRemaining(getTimeUntilMidnight());
            // If it's exactly midnight, refresh the default selected date
            const currentIST = getISTDateStr();
            if (currentIST !== getISTDateStr(new Date(Date.now() - 1000))) {
                setSelectedDate(currentIST);
            }
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Auto-redirect if class and section are provided in state
        const state = location.state;
        if (state?.class && state?.section) {
            navigate(`${dashboardPath}/attendance/${state.class}/${state.section}`, { replace: true, state: { date: state.date } });
            return;
        }
        fetchClassSections();
    }, [selectedDate]);

    useEffect(() => {
        fetchAttendanceStatus();
    }, [selectedDate]);

    const fetchAttendanceStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/get-status?date=${selectedDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMarkedSections(response.data.markedSections || []);
        } catch (error) {
            console.error('Error fetching attendance status:', error);
        }
    };

    const fetchClassSections = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const students = response.data.students || [];
            const classSet = new Set();
            const sectionMap = {};

            students.forEach(s => {
                const cls = String(s.class || '').trim();
                const sec = String(s.section || '').trim();

                if (cls && sec) {
                    classSet.add(cls);
                    if (!sectionMap[cls]) {
                        sectionMap[cls] = new Set();
                    }
                    sectionMap[cls].add(sec);
                }
            });

            const sortedClasses = Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const sectionObj = {};
            const countObj = {};

            sortedClasses.forEach(cls => {
                sectionObj[cls] = Array.from(sectionMap[cls]).sort();
                countObj[cls] = {};
                sectionObj[cls].forEach(sec => {
                    countObj[cls][sec] = students.filter(s => String(s.class).trim() === cls && String(s.section).trim() === sec).length;
                });
            });

            setClasses(sortedClasses);
            setSections(sectionObj);
            setStudentCounts(countObj);
        } catch (error) {
            console.error('Attendance Fetch Error:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                token: localStorage.getItem('token')?.substring(0, 10) + '...'
            });
            toast.error(`Failed to load classes: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="attendance-loading">
                <div className="spinner"></div>
                <p>Loading classes...</p>
            </div>
        );
    }

    const isToday = selectedDate === getISTDateStr();
    const isYesterday = selectedDate === getISTDateStr(new Date(Date.now() - 86400000));

    return (
        <>
            <div className="header-toolbar-free">
                <div className="header-left-side">
                    <button className="back-btn-minimal" onClick={() => navigate(dashboardPath)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1>Select Class & Section</h1>
                </div>
                
                <div className="premium-date-picker">
                    <div className="date-input-wrapper" style={{ borderLeft: 'none', paddingLeft: 0 }}>
                        <input 
                            id="att-date"
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={getISTDateStr()}
                            className="ist-date-input"
                        />
                    </div>
                </div>
            </div>

            {classes.length === 0 ? (
                <div className="empty-state-card">
                    <div className="empty-icon-vibe">📅</div>
                    <h3>No academic sessions found</h3>
                    <p>Configure student profiles to begin tracking attendance.</p>
                </div>
            ) : (
                <div className="class-grid">
                    {classes.map((cls, index) => (
                        <div key={cls} className={`class-card color-${index % 6}`}>
                            <div className="class-header">
                                <div className="class-icon">
                                    <span>{cls}</span>
                                </div>
                                <h2>Class {cls}</h2>
                            </div>
                            <div className="sections-list">
                                {sections[cls]?.map(sec => {
                                    const isMarked = markedSections.some(m => String(m.class) === String(cls) && String(m.section) === String(sec));
                                    
                                    return (
                                        <div
                                            key={sec}
                                            className={`section-item ${isMarked ? 'marked' : ''}`}
                                            onClick={() => navigate(`${dashboardPath}/attendance/${cls}/${sec}`, { state: { date: selectedDate } })}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span className="sec-name">Section {sec}</span>
                                                {isMarked && (
                                                    <div className="marked-check">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="sec-count">{studentCounts[cls]?.[sec] || 0} students</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default Attendance;
