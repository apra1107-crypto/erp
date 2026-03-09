import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './ClassHomework.css';

const ClassHomework = () => {
    const { className, section } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [homeworkList, setHomeworkList] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Completion List State
    const [showCompletions, setShowCompletions] = useState(false);
    const [completionData, setCompletionData] = useState({ done: [], pending: [] });
    const [loadingCompletions, setLoadingCompletions] = useState(false);
    const [activeTab, setActiveTab] = useState('done');
    const [selectedHW, setSelectedHW] = useState(null);

    const fetchHomework = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const userData = localStorage.getItem('userData');
            const parsedData = userData ? JSON.parse(userData) : null;
            const sessionId = storedSessionId || parsedData?.current_session_id;

            console.log('Fetching HW for:', { className, section, selectedDate, sessionId });

            if (!token || !sessionId) {
                console.error('Missing token or sessionId');
                return;
            }

            const response = await axios.get(
                `${API_ENDPOINTS.HOMEWORK}/list?class_name=${className}&section=${section}&date=${selectedDate}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId.toString()
                    } 
                }
            );

            console.log('HW List Response:', response.data);
            setHomeworkList(response.data || []);
        } catch (error) {
            console.error('Error fetching homework:', error);
            toast.error('Failed to load homework');
        } finally {
            setLoading(false);
        }
    }, [className, section, selectedDate]);

    useEffect(() => {
        fetchHomework();
    }, [fetchHomework]);

    const handleSaveHomework = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !content.trim()) {
            toast.error('Please fill all fields');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            const userData = localStorage.getItem('userData');
            const parsedData = userData ? JSON.parse(userData) : null;
            const sessionId = (storedSessionId || parsedData?.current_session_id)?.toString();

            if (editingId) {
                await axios.put(
                    `${API_ENDPOINTS.HOMEWORK}/update/${editingId}`,
                    { subject, content },
                    { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId } }
                );
                toast.success('Homework updated successfully');
            } else {
                await axios.post(
                    `${API_ENDPOINTS.HOMEWORK}/create`,
                    { class_name: className, section: section, subject: subject, content: content, date: selectedDate },
                    { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId } }
                );
                toast.success('Homework added successfully');
            }

            setShowModal(false);
            setSubject('');
            setContent('');
            setEditingId(null);
            fetchHomework();
        } catch (error) {
            console.error('Error saving homework:', error);
            toast.error('Failed to save homework');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this homework?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.HOMEWORK}/delete/${id}`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            toast.success('Homework deleted');
            fetchHomework();
        } catch (error) {
            toast.error('Failed to delete homework');
        }
    };

    const fetchCompletions = async (hw) => {
        try {
            setSelectedHW(hw);
            setLoadingCompletions(true);
            setShowCompletions(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.HOMEWORK}/completions/${hw.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompletionData(response.data);
        } catch (error) {
            console.error('Error fetching completions:', error);
        } finally {
            setLoadingCompletions(false);
        }
    };

    const openEditModal = (item) => {
        setSubject(item.subject);
        setContent(item.content);
        setEditingId(item.id);
        setShowModal(true);
    };

    const changeDate = (days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    return (
        <div className="class-homework-container">
            <header className="homework-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard/homework')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <h1>Homework</h1>
                    <span className="header-divider">/</span>
                    <span className="class-section-display">Class {className}-{section}</span>
                </div>
                <div className="header-right">
                    <div className="date-selection-wrapper">
                        <label className="date-picker-label">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            <span>{new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="hidden-date-input"
                            />
                        </label>
                    </div>
                    <button className="add-hw-btn" onClick={() => { setEditingId(null); setSubject(''); setContent(''); setShowModal(true); }}>
                        <span>+</span> Post Homework
                    </button>
                </div>
            </header>

            <main className="homework-content-area">
                {loading ? (
                    <div className="hw-loader">Loading assignments...</div>
                ) : homeworkList.length > 0 ? (
                    <div className="homework-grid">
                        {homeworkList.map((hw) => (
                            <div key={hw.id} className="homework-card">
                                <div className="card-accent" />
                                <div className="card-header">
                                    <div className="subject-badge-container">
                                        <div className="subject-icon">
                                            {hw.subject.charAt(0).toUpperCase()}
                                        </div>
                                        <h3>{hw.subject}</h3>
                                    </div>
                                    <div className="card-actions">
                                        <button onClick={() => openEditModal(hw)} className="edit-action" title="Edit">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button onClick={() => handleDelete(hw.id)} className="delete-action" title="Delete">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="hw-content-wrapper">
                                    <p className="hw-body">{hw.content}</p>
                                </div>
                                <div className="card-footer">
                                    <div className="posted-info">
                                        <div className="teacher-avatar-mini">
                                            {hw.teacher_name.charAt(0)}
                                        </div>
                                        <span className="posted-by">By {hw.teacher_name}</span>
                                    </div>
                                    <button className="premium-completion-badge" onClick={() => fetchCompletions(hw)}>
                                        <div className="completion-progress-ring">
                                            <svg viewBox="0 0 36 36" className="circular-chart">
                                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                                <path className="circle" strokeDasharray={`${Math.round((hw.done_count / hw.total_students) * 100)}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                            </svg>
                                        </div>
                                        <span className="completion-text">{hw.done_count}/{hw.total_students} Done</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="hw-empty-state">
                        <div className="empty-box">📝</div>
                        <h3>No Homework Assigned</h3>
                        <p>Relax! No assignments found for this date.</p>
                    </div>
                )}
            </main>

            {/* Post/Edit Modal */}
            {showModal && (
                <div className="hw-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="hw-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit Homework' : 'New Assignment'}</h2>
                            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveHomework}>
                            <div className="form-group">
                                <label>Subject</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Mathematics" 
                                    value={subject} 
                                    onChange={(e) => setSubject(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Content</label>
                                <textarea 
                                    placeholder="What's the task?" 
                                    value={content} 
                                    onChange={(e) => setContent(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">Cancel</button>
                                <button type="submit" className="save-btn" disabled={saving}>
                                    {saving ? 'Posting...' : (editingId ? 'Update' : 'Post Homework')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Completions Modal */}
            {showCompletions && (
                <div className="hw-modal-overlay" onClick={() => setShowCompletions(false)}>
                    <div className="completions-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <h2>Submission Status</h2>
                                <p>{selectedHW?.subject}</p>
                            </div>
                            <button className="modal-close-btn" onClick={() => setShowCompletions(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div className="tabs-row">
                            <button 
                                className={`tab-btn ${activeTab === 'done' ? 'active active-done' : ''}`}
                                onClick={() => setActiveTab('done')}
                            >
                                Done ({completionData.done.length})
                            </button>
                            <button 
                                className={`tab-btn ${activeTab === 'pending' ? 'active active-pending' : ''}`}
                                onClick={() => setActiveTab('pending')}
                            >
                                Pending ({completionData.pending.length})
                            </button>
                        </div>
                        <div className="student-list-container">
                            {loadingCompletions ? (
                                <div className="list-loader">Updating...</div>
                            ) : (activeTab === 'done' ? completionData.done : completionData.pending).length > 0 ? (
                                <div className="student-list">
                                    {(activeTab === 'done' ? completionData.done : completionData.pending).map((student, i) => (
                                        <div key={i} className="student-item">
                                            <div className="student-avatar">
                                                {student.photo_url ? <img src={student.photo_url} alt="" /> : student.name[0]}
                                            </div>
                                            <div className="student-info">
                                                <span className="name">{student.name}</span>
                                                <span className="roll">Roll No: {student.roll_no}</span>
                                            </div>
                                            {activeTab === 'done' && (
                                                <span className="done-time">
                                                    {new Date(student.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="list-empty">
                                    {activeTab === 'done' ? 'No one has finished yet.' : 'Everyone has finished! 🎉'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassHomework;
