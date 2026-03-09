import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Attendance.css';

const TakeAttendance = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { class: className, section } = useParams();
    const userType = localStorage.getItem('userType');
    const dashboardPath = userType === 'teacher' ? '/teacher-dashboard' : '/dashboard';

    // Get current IST date
    const getISTDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    const [selectedDate, setSelectedDate] = useState(location.state?.date || getISTDate());
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [absentRequests, setAbsentRequests] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');

            // Fetch students
            const studentsRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list?class=${className}&section=${section}&date=${selectedDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const allStudents = studentsRes.data.students || [];
            const filtered = allStudents.filter(s => s.class === className && s.section === section);
            setStudents(filtered);

            // Fetch existing attendance
            const attendanceRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/view?class=${className}&section=${section}&date=${selectedDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const existingAttendance = attendanceRes.data.attendance || [];
            const attendanceMap = {};
            existingAttendance.forEach(a => {
                attendanceMap[a.student_id] = a.status;
            });
            setAttendance(attendanceMap);

            // Fetch logs
            const logsRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/logs?class=${className}&section=${section}&date=${selectedDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setLogs(logsRes.data.logs || []);

            // Fetch absent requests
            const requestsRes = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/view?class=${className}&section=${section}&date=${selectedDate}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAbsentRequests(requestsRes.data.requests || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load attendance data');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRequest = async (requestId) => {
        setApproving(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/approve/${requestId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Request approved and student marked absent');
            setShowRequestModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to approve request');
        } finally {
            setApproving(false);
        }
    };

    const toggleAttendance = (studentId, status) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: prev[studentId] === status ? null : status
        }));
    };

    const handleSave = async () => {
        // Check if all students are marked
        const unmarked = students.filter(s => !attendance[s.id]);
        if (unmarked.length > 0) {
            toast.error(`Please mark attendance for all ${students.length} students`);
            return;
        }

        setSaving(true);
        try {
            const token = localStorage.getItem('token');

            const attendanceArray = students.map(s => ({
                student_id: s.id,
                status: attendance[s.id]
            }));

            await axios.post(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/take`,
                {
                    class: className,
                    section: section,
                    date: selectedDate,
                    attendance: attendanceArray
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success('Attendance saved successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const getStats = () => {
        const total = students.length;
        const present = students.filter(s => attendance[s.id] === 'present').length;
        const absent = students.filter(s => attendance[s.id] === 'absent').length;
        const unmarked = total - present - absent;
        return { total, present, absent, unmarked };
    };

    const stats = getStats();

    if (loading) {
        return (
            <div className="attendance-loading">
                <div className="spinner"></div>
                <p>Loading attendance data...</p>
            </div>
        );
    }

    return (
        <div className="attendance-page-wrapper">
            {/* Header Top - Left side (Back + Text) | Right side (Date Selector) */}
            <div className="take-attendance-header-modern">
                {/* Left Side - Back Button + Text */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                    <button className="back-btn-free" onClick={() => navigate(`${dashboardPath}/attendance`)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Text Block - Free Flow */}
                    <div className="text-block-free">
                        <h1>Take Attendance</h1>
                        <p>Class {className} - Section {section}</p>
                    </div>
                </div>

                {/* Right Side - Date Selector + Save Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="premium-date-picker-mini">
                        <input
                            id="date-input"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={getISTDate()}
                            className="ist-date-input"
                        />
                    </div>
                    <button className="save-btn-free" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <div className="spinner small"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Save Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Cards Row - Compact Free Flow */}
            <div className="attendance-stats-shelf">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', width: '100%', maxWidth: '1200px' }}>
                {/* Total Enrollment Card */}
                <div className="att-stat-card enrollment">
                    <div className="stat-icon-bg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Total Students</p>
                        <h3 className="stat-value">{stats.total}</h3>
                    </div>
                </div>

                {/* Present Today Card */}
                <div className="att-stat-card present">
                    <div className="stat-icon-bg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Present Today</p>
                        <h3 className="stat-value">{stats.present}</h3>
                    </div>
                </div>

                {/* Absent Students Card */}
                <div className="att-stat-card absent">
                    <div className="stat-icon-bg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Absent</p>
                        <h3 className="stat-value">{stats.absent}</h3>
                    </div>
                </div>

                {/* Pending Action Card */}
                <div className="att-stat-card unmarked">
                    <div className="stat-icon-bg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">Unmarked</p>
                        <h3 className="stat-value">{stats.unmarked}</h3>
                    </div>
                </div>
            </div>
        </div>

            {/* Stats Section */}
            <div className="attendance-content-area">
                <div className="date-selector-container" style={{ display: 'none' }}>
                </div>
            </div>

            {/* Main Content Area - Table and History Split View */}
            <div className="attendance-main-split">
                {/* Left Side - Table */}
                <div className="attendance-table-side">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--att-border)' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--att-text)' }}>
                            Student Attendance ({students.length})
                        </h2>
                    </div>
                    
                    {students.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--att-text-muted)' }}>
                            <p>No students found</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--att-border)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'var(--att-border)', borderBottom: '2px solid var(--att-border)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--att-text-muted)', letterSpacing: '0.05em' }}>Roll No</th>
                                        <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--att-text-muted)', letterSpacing: '0.05em' }}>Student</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--att-text-muted)', letterSpacing: '0.05em' }}>Status</th>
                                        <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--att-text-muted)', letterSpacing: '0.05em' }}>Marking</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, index) => {
                                        const request = absentRequests.find(r => r.student_id === student.id);
                                        const status = attendance[student.id];

                                        return (
                                            <tr 
                                                key={student.id}
                                                style={{
                                                    borderBottom: '1px solid var(--att-border)',
                                                    background: index % 2 === 0 ? 'var(--att-card-bg)' : 'var(--att-page-bg)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <td style={{ padding: '1rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--att-primary)' }}>
                                                    {student.roll_no}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '8px',
                                                            overflow: 'hidden',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: 'var(--att-page-bg)',
                                                            border: '1.5px solid var(--att-border)'
                                                        }}>
                                                            {student.photo_url ? (
                                                                <img src={student.photo_url} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ fontSize: '1.1rem' }}>👤</div>
                                                            )}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--att-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {student.name}
                                                            </h4>
                                                            <p style={{ fontSize: '0.75rem', color: 'var(--att-text-muted)', margin: '0.2rem 0 0 0' }}>
                                                                {student.class} - {student.section}
                                                            </p>
                                                            {request && (
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--att-warning)', background: 'var(--att-warning-soft)', padding: '0.2rem 0.4rem', borderRadius: '3px', display: 'inline-block', marginTop: '0.3rem' }}>
                                                                    📋 {request.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    {status === 'present' && (
                                                        <div style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, background: 'var(--att-success)', color: 'white' }}>
                                                            ✓ Present
                                                        </div>
                                                    )}
                                                    {status === 'absent' && (
                                                        <div style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, background: 'var(--att-danger)', color: 'white' }}>
                                                            ✗ Absent
                                                        </div>
                                                    )}
                                                    {!status && (
                                                        <div style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, background: 'var(--att-border)', color: 'var(--att-text-muted)' }}>
                                                            ○ Unmarked
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <button
                                                            style={{
                                                                padding: '0.5rem 0.8rem',
                                                                border: status === 'present' ? '2px solid var(--att-success)' : '1.5px solid var(--att-border)',
                                                                background: status === 'present' ? 'var(--att-success)' : 'transparent',
                                                                color: status === 'present' ? 'white' : 'var(--att-success)',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onClick={() => toggleAttendance(student.id, 'present')}
                                                            title="Mark Present (click again to unmark)"
                                                        >
                                                            ✓ P
                                                        </button>
                                                        <button
                                                            style={{
                                                                padding: '0.5rem 0.8rem',
                                                                border: status === 'absent' ? '2px solid var(--att-danger)' : '1.5px solid var(--att-border)',
                                                                background: status === 'absent' ? 'var(--att-danger)' : 'transparent',
                                                                color: status === 'absent' ? 'white' : 'var(--att-danger)',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                            onClick={() => toggleAttendance(student.id, 'absent')}
                                                            title="Mark Absent (click again to unmark)"
                                                        >
                                                            ✗ A
                                                        </button>
                                                        {request && (
                                                            <button
                                                                style={{
                                                                    padding: '0.5rem 0.5rem',
                                                                    border: '1.5px solid var(--att-warning)',
                                                                    background: 'var(--att-warning-soft)',
                                                                    color: 'var(--att-warning)',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                                onClick={() => {
                                                                    setSelectedRequest(request);
                                                                    setShowRequestModal(true);
                                                                }}
                                                                title="View Request"
                                                            >
                                                                📄
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Right Side - Update History */}
                {logs.length > 0 && (
                    <div className="attendance-logs-side">
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 1.5rem 0', paddingBottom: '1rem', borderBottom: '2px solid var(--att-border)', color: 'var(--att-text)' }}>
                            Update History
                        </h2>
                        <div style={{ background: 'var(--att-card-bg)', border: '1px solid var(--att-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {logs.map((log, index) => (
                                <div key={index} style={{ padding: '1.2rem', background: 'var(--att-page-bg)', borderRadius: '8px', borderLeft: '4px solid var(--att-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--att-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                👤 {log.teacher_name}
                                            </h4>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--att-text-muted)', margin: '0.4rem 0 0 0' }}>
                                                🕐 {formatTime(log.created_at)}
                                            </p>
                                        </div>
                                        <span style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 700, 
                                            padding: '0.3rem 0.6rem', 
                                            borderRadius: '4px',
                                            background: log.action_type === 'initial' ? 'var(--att-success-soft)' : 'var(--att-warning-soft)',
                                            color: log.action_type === 'initial' ? 'var(--att-success)' : 'var(--att-warning)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {log.action_type === 'initial' ? '✓ Initial' : '✏️ Modified'}
                                        </span>
                                    </div>

                                    {/* Show detailed changes if it's a modification */}
                                    {log.action_type === 'modified' && log.changes_made && (
                                        <div style={{ 
                                            background: 'var(--att-warning-soft)', 
                                            padding: '0.8rem', 
                                            borderRadius: '6px', 
                                            marginBottom: '1rem',
                                            borderLeft: '3px solid var(--att-warning)'
                                        }}>
                                            {(() => {
                                                try {
                                                    const changes = JSON.parse(log.changes_made);
                                                    return (
                                                        <div>
                                                            <p style={{ 
                                                                fontSize: '0.85rem', 
                                                                color: 'var(--att-text)', 
                                                                margin: '0 0 0.5rem 0',
                                                                fontWeight: 600
                                                            }}>
                                                                📝 {changes.total} students modified:
                                                            </p>
                                                            {changes.absentToPresent.length > 0 && (
                                                                <p style={{ 
                                                                    fontSize: '0.8rem', 
                                                                    color: 'var(--att-success)', 
                                                                    margin: '0.4rem 0',
                                                                    fontWeight: 600
                                                                }}>
                                                                    ✓ Marked Present (Absent→Present): {changes.absentToPresent.join(', ')}
                                                                </p>
                                                            )}
                                                            {changes.presentToAbsent.length > 0 && (
                                                                <p style={{ 
                                                                    fontSize: '0.8rem', 
                                                                    color: 'var(--att-danger)', 
                                                                    margin: '0.4rem 0',
                                                                    fontWeight: 600
                                                                }}>
                                                                    ✗ Marked Absent (Present→Absent): {changes.presentToAbsent.join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                } catch (e) {
                                                    return <p style={{ fontSize: '0.85rem', color: 'var(--att-text)', margin: 0, fontWeight: 600 }}>📝 Changes: {log.changes_made}</p>;
                                                }
                                            })()}
                                        </div>
                                    )}

                                    {/* Stats boxes */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                        <div style={{ background: 'var(--att-success-soft)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--att-text-muted)' }}>Present</span>
                                            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--att-success)', margin: '0.25rem 0 0 0' }}>
                                                {log.present_count}
                                            </p>
                                        </div>
                                        <div style={{ background: 'var(--att-danger-soft)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--att-text-muted)' }}>Absent</span>
                                            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--att-danger)', margin: '0.25rem 0 0 0' }}>
                                                {log.absent_count}
                                            </p>
                                        </div>
                                        <div style={{ background: 'var(--att-border)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--att-text-muted)' }}>Total</span>
                                            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--att-primary)', margin: '0.25rem 0 0 0' }}>
                                                {log.total_students}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Absent Request Modal */}
            {showRequestModal && selectedRequest && (
                <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-student-info">
                                <div className="modal-student-photo">
                                    {selectedRequest.photo_url ? (
                                        <img src={selectedRequest.photo_url} alt={selectedRequest.student_name} />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3>{selectedRequest.student_name}</h3>
                                    <p>Roll No: {selectedRequest.roll_no} • Class {className}-{section}</p>
                                </div>
                            </div>
                            <span className={`status-badge ${selectedRequest.status}`}>
                                {selectedRequest.status}
                            </span>
                        </div>

                        <div className="modal-body">
                            <div className="reason-section">
                                <label>Reason for Absence</label>
                                <p>{selectedRequest.reason}</p>
                            </div>

                            {selectedRequest.status === 'approved' && (
                                <div className="approval-info">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    <div>
                                        <p className="approval-text">
                                            Approved by {selectedRequest.approved_by_teacher_name || selectedRequest.approved_by_principal_name}
                                        </p>
                                        <p className="approval-time">
                                            {new Date(selectedRequest.approved_at).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="modal-btn close" onClick={() => setShowRequestModal(false)}>
                                Close
                            </button>
                            {selectedRequest.status === 'pending' && (
                                <button
                                    className="modal-btn approve"
                                    onClick={() => handleApproveRequest(selectedRequest.id)}
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <>
                                            <div className="spinner small"></div>
                                            Approving...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                <polyline points="22 4 12 14.01 9 11.01" />
                                            </svg>
                                            Approve Request
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Absent Notes Modal */}
        </div>
    );
};

export default TakeAttendance;
