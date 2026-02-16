import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Attendance.css';

const StudentAttendanceHistory = () => {
    const navigate = useNavigate();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [attendanceData, setAttendanceData] = useState([]);
    const [absentRequests, setAbsentRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Dialog states
    const [showAbsentNoteDialog, setShowAbsentNoteDialog] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [noteMessage, setNoteMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // Edit dialog states
    const [editingNote, setEditingNote] = useState(null);
    const [editMessage, setEditMessage] = useState('');
    const [editSubmitting, setEditSubmitting] = useState(false);

    // Fetch attendance and absent requests
    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const [year, month] = selectedMonth.split('-');
            const monthNum = parseInt(month);
            const yearNum = parseInt(year);
            
            // Start: First day of month
            const monthStart = `${year}-${month}-01`;
            
            // End: Last day of month - calculate without timezone issues
            // Use the fact that day 0 of next month = last day of current month
            const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
            const monthEnd = String(daysInMonth).padStart(2, '0');
            const monthEndStr = `${year}-${month}-${monthEnd}`;

            console.log('🔄 Fetching attendance from', monthStart, 'to', monthEndStr);
            console.log('Month:', selectedMonth, 'Year:', yearNum, 'Month Num:', monthNum, 'Days:', daysInMonth);

            // Fetch attendance for the month
            const attendanceRes = await axios.get(
                `${API_ENDPOINTS.ATTENDANCE}/my-attendance?startDate=${monthStart}&endDate=${monthEndStr}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            console.log('✅ Attendance data received. Count:', attendanceRes.data.attendance?.length || 0);
            console.log('📊 Data:', attendanceRes.data.attendance);
            setAttendanceData(attendanceRes.data.attendance || []);

            // Fetch absent requests
            const requestsRes = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/my-requests`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAbsentRequests(requestsRes.data.requests || []);
        } catch (error) {
            console.error('❌ Error fetching data:', error);
            toast.error('Failed to load attendance data: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats
    const stats = {
        present: attendanceData.filter(a => a.status === 'present').length,
        absent: attendanceData.filter(a => a.status === 'absent').length,
        total: attendanceData.length
    };

    // Get all days of the month with attendance data
    const getDaysOfMonth = () => {
        const year = parseInt(selectedMonth.split('-')[0]);
        const month = parseInt(selectedMonth.split('-')[1]);
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sunday, 6 = Saturday
        const days = [];

        console.log('=== CALENDAR DEBUG ===');
        console.log('Selected month:', selectedMonth);
        console.log('Year:', year, 'Month:', month);
        console.log('Days in month:', daysInMonth);
        console.log('First day of month:', firstDayOfMonth, '(0=Sun, 1=Mon, ..., 6=Sat)');
        
        const firstDate = new Date(year, month - 1, 1);
        console.log('First day details:', firstDate.toDateString());
        console.log('Available attendance data:', attendanceData.length, 'records');

        // Add empty cells for days before the 1st
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push({
                date: null,
                day: null,
                status: null,
                marked_by: null,
                isEmpty: true
            });
        }
        console.log('Empty cells added:', firstDayOfMonth);

        // Add all days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const dayStr = String(i).padStart(2, '0');
            const date = `${selectedMonth}-${dayStr}`;
            const attendance = attendanceData.find(a => a.date === date);
            
            days.push({
                date,
                day: i,
                status: attendance?.status || null,
                marked_by: attendance?.marked_by || null,
                isEmpty: false,
                weekday: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' })
            });
            
            if (i <= 5) {
                console.log(`Day ${i}: ${date} - Status: ${attendance?.status || 'unmarked'}`);
            }
        }
        
        console.log('Total calendar cells:', days.length, '(should be multiple of 7)');
        console.log('=== END DEBUG ===');
        
        return days;
    };

    const daysOfMonth = getDaysOfMonth();

    const handleSubmitAbsentNote = async () => {
        if (!selectedDate || !noteMessage.trim()) {
            toast.error('Please select date and enter message');
            return;
        }

        setSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/submit`,
                { date: selectedDate, reason: noteMessage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Absent note submitted successfully');
            setShowAbsentNoteDialog(false);
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setNoteMessage('');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit absent note');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateNote = async () => {
        if (!editMessage.trim()) {
            toast.error('Please enter message');
            return;
        }

        setEditSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.put(
                `${API_ENDPOINTS.ABSENT_REQUEST}/${editingNote.id}`,
                { reason: editMessage },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Absent note updated successfully');
            setEditingNote(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update absent note');
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${API_ENDPOINTS.ABSENT_REQUEST}/${id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success('Absent note deleted successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete absent note');
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--att-text-muted)' }}>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'var(--att-card-bg)',
                            border: '1px solid var(--att-border)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>Attendance History</h1>
                    <button
                        onClick={fetchData}
                        title="Refresh attendance data"
                        style={{
                            background: 'var(--att-card-bg)',
                            border: '1px solid var(--att-border)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '1rem'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 4v6h6M23 20v-6h-6" />
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                        </svg>
                    </button>
                </div>
                <button
                    onClick={() => setShowAbsentNoteDialog(true)}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    📝 Add Absent Note
                </button>
            </div>

            {/* Main Content - Two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                {/* LEFT: Attendance Stats */}
                <div style={{
                    background: 'var(--att-card-bg)',
                    border: '1px solid var(--att-border)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            Select Month & Year
                        </label>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '1px solid var(--att-border)',
                                fontSize: '0.95rem',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            borderRadius: '10px',
                            padding: '1rem',
                            color: 'white'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>Present</p>
                            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem' }}>
                                {attendanceData.filter(a => a.status === 'present').length}
                            </div>
                        </div>
                        <div style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            borderRadius: '10px',
                            padding: '1rem',
                            color: 'white'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>Absent</p>
                            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem' }}>
                                {attendanceData.filter(a => a.status === 'absent').length}
                            </div>
                        </div>
                    </div>

                    <h4 style={{ margin: '1.5rem 0 1rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                        Attendance Calendar
                    </h4>

                    {/* Calendar Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, 1fr)',
                        gap: '0.75rem'
                    }}>
                        {/* Weekday headers */}
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div
                                key={day}
                                style={{
                                    textAlign: 'center',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    color: 'var(--att-text-muted)',
                                    padding: '0.5rem',
                                    borderBottom: '1px solid var(--att-border)'
                                }}
                            >
                                {day}
                            </div>
                        ))}

                        {/* Calendar days */}
                        {daysOfMonth.map((day, idx) => (
                            day.isEmpty ? (
                                <div key={`empty-${idx}`}></div>
                            ) : (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '0.75rem',
                                        textAlign: 'center',
                                        borderRadius: '8px',
                                        background: day.status === 'present' 
                                            ? 'rgba(16, 185, 129, 0.25)' 
                                            : day.status === 'absent' 
                                            ? 'rgba(239, 68, 68, 0.25)' 
                                            : 'var(--att-border)',
                                        border: day.status === 'present' 
                                            ? '2px solid #10b981' 
                                            : day.status === 'absent' 
                                            ? '2px solid #ef4444' 
                                            : '1px solid var(--att-border)',
                                        cursor: 'default',
                                        minHeight: '70px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        position: 'relative'
                                    }}
                                    title={day.marked_by ? `Marked by: ${day.marked_by}` : 'Not marked'}
                                >
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--att-text)' }}>
                                        {day.day}
                                    </div>
                                    <div style={{ 
                                        fontSize: '1.5rem', 
                                        fontWeight: 800,
                                        color: day.status === 'present' 
                                            ? '#10b981' 
                                            : day.status === 'absent' 
                                            ? '#ef4444' 
                                            : 'var(--att-text-muted)'
                                    }}>
                                        {day.status === 'present' ? '✓' : day.status === 'absent' ? '✗' : '-'}
                                    </div>
                                    {day.marked_by && (
                                        <div style={{ 
                                            fontSize: '0.65rem', 
                                            marginTop: '0.35rem',
                                            color: 'var(--att-text-muted)',
                                            fontWeight: 600,
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            👤 {day.marked_by}
                                        </div>
                                    )}
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* RIGHT: Absent Notes History */}
                <div style={{
                    background: 'var(--att-card-bg)',
                    border: '1px solid var(--att-border)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    maxHeight: '800px',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                        Absent Notes History
                    </h3>

                    {absentRequests.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '2rem',
                            color: 'var(--att-text-muted)',
                            background: 'var(--att-page-bg)',
                            borderRadius: '8px'
                        }}>
                            <p>No absent notes submitted</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {absentRequests.map(note => (
                                <div
                                    key={note.id}
                                    style={{
                                        background: 'var(--att-page-bg)',
                                        border: `2px solid ${note.status === 'pending' ? 'var(--att-warning)' : note.status === 'approved' ? '#10b981' : 'var(--att-danger)'}`,
                                        borderRadius: '10px',
                                        padding: '1rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--att-text)' }}>
                                                📅 {new Date(note.date).toLocaleDateString()}
                                            </p>
                                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--att-text-muted)' }}>
                                                {note.reason}
                                            </p>
                                        </div>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '20px',
                                            background: note.status === 'pending' ? 'var(--att-warning-soft)' : note.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : 'var(--att-danger-soft)',
                                            color: note.status === 'pending' ? 'var(--att-warning)' : note.status === 'approved' ? '#10b981' : 'var(--att-danger)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {note.status === 'approved' ? '✓ Approved' : note.status === 'pending' ? '⏳ Pending' : '✗ Rejected'}
                                        </span>
                                    </div>

                                    {note.status === 'approved' && note.approved_by_teacher_name && (
                                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                                            Approved by {note.approved_by_teacher_name}
                                        </p>
                                    )}

                                    {note.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                            <button
                                                onClick={() => { setEditingNote(note); setEditMessage(note.reason); }}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    background: 'var(--att-primary-soft)',
                                                    color: 'var(--att-primary)',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontWeight: 600,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteNote(note.id)}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    background: 'var(--att-danger-soft)',
                                                    color: 'var(--att-danger)',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontWeight: 600,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Absent Note Dialog */}
            {showAbsentNoteDialog && (
                <div className="modal-overlay" onClick={() => setShowAbsentNoteDialog(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <header className="modal-header">
                            <div>
                                <h2>Add Absent Note</h2>
                                <p>Submit a reason for your absence</p>
                            </div>
                            <button className="close-modal-btn" onClick={() => setShowAbsentNoteDialog(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </header>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                                    Select Date
                                </label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--att-border)',
                                        fontSize: '0.95rem',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                                    Message
                                </label>
                                <textarea
                                    value={noteMessage}
                                    onChange={(e) => setNoteMessage(e.target.value)}
                                    placeholder="Enter reason for absence..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--att-border)',
                                        minHeight: '120px',
                                        fontSize: '0.95rem',
                                        fontFamily: 'inherit',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setShowAbsentNoteDialog(false)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: 'var(--att-border)',
                                        color: 'var(--att-text)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitAbsentNote}
                                    disabled={submitting}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Absent Note Dialog */}
            {editingNote && (
                <div className="modal-overlay" onClick={() => setEditingNote(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <header className="modal-header">
                            <div>
                                <h2>Edit Absent Note</h2>
                                <p>Update your absence reason</p>
                            </div>
                            <button className="close-modal-btn" onClick={() => setEditingNote(null)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </header>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                                    Date: {new Date(editingNote.date).toLocaleDateString()}
                                </label>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                                    Message
                                </label>
                                <textarea
                                    value={editMessage}
                                    onChange={(e) => setEditMessage(e.target.value)}
                                    placeholder="Enter reason for absence..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--att-border)',
                                        minHeight: '120px',
                                        fontSize: '0.95rem',
                                        fontFamily: 'inherit',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setEditingNote(null)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: 'var(--att-border)',
                                        color: 'var(--att-text)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateNote}
                                    disabled={editSubmitting}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: editSubmitting ? 'not-allowed' : 'pointer',
                                        opacity: editSubmitting ? 0.7 : 1
                                    }}
                                >
                                    {editSubmitting ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAttendanceHistory;
