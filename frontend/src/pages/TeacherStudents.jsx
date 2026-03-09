import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Students.css';

const TeacherStudents = () => {
    const navigate = useNavigate();
    const { id: paramId } = useParams();
    const [viewMode, setViewMode] = useState('list'); // 'list', 'add', 'edit'
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showAttendanceView, setShowAttendanceView] = useState(false);
    const [showFeesView, setShowFeesView] = useState(false);
    const [attendanceData, setAttendanceData] = useState([]);
    const [absentRequests, setAbsentRequests] = useState([]);
    const [attendanceMonth, setAttendanceMonth] = useState(new Date());
    const [feeHistory, setFeeHistory] = useState(null);

    // Form State
    const initialFormState = {
        name: '',
        class: '',
        section: '',
        roll_no: '',
        dob: '',
        gender: '',
        father_name: '',
        mother_name: '',
        mobile: '',
        email: '',
        address: '',
        transport_facility: 'false',
        monthly_fees: '',
        transport_fees: '',
        photo: null
    };
    const [formData, setFormData] = useState(initialFormState);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        class: '',
        section: '',
        roll_no: '',
        transport: ''
    });

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudents(response.data.students || []);
            setFilteredStudents(response.data.students || []);
        } catch (error) {
            console.error('Error fetching students:', error);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentFees = async (studentId) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/${studentId}/fees-full`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeeHistory(response.data);
        } catch (error) {
            console.error('Error fetching student fees:', error);
            toast.error('Failed to load fee history');
        } finally {
            setLoading(false);
        }
    };

    const fetchStudentAttendance = async (studentId, monthDate) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const year = monthDate.getFullYear();
            const month = String(monthDate.getMonth() + 1).padStart(2, '0');
            const daysInMonth = new Date(year, monthDate.getMonth() + 1, 0).getDate();
            
            const startDate = `${year}-${month}-01`;
            const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;

            const attResponse = await axios.get(`${API_ENDPOINTS.ATTENDANCE}/student/${studentId}?startDate=${startDate}&endDate=${endDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAttendanceData(attResponse.data.attendance || []);

            const reqResponse = await axios.get(`${API_ENDPOINTS.ABSENT_REQUEST}/student/${studentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAbsentRequests(reqResponse.data.requests || []);
        } catch (error) {
            console.error('Error fetching student attendance:', error);
            toast.error('Failed to load attendance details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    useEffect(() => {
        if (paramId && students.length > 0) {
            const student = students.find(s => s.id.toString() === paramId.toString());
            if (student) {
                setSelectedStudent(student);
                setShowDetailsModal(true);
            }
        }
    }, [paramId, students]);

    useEffect(() => {
        let result = students;
        if (filters.class) {
            result = result.filter(s => s.class.toLowerCase().includes(filters.class.toLowerCase()));
        }
        if (filters.section) {
            result = result.filter(s => s.section.toLowerCase().includes(filters.section.toLowerCase()));
        }
        if (filters.roll_no) {
            result = result.filter(s => s.roll_no.toString().includes(filters.roll_no));
        }
        if (filters.transport) {
            const needsTransport = filters.transport === 'yes';
            result = result.filter(s => Boolean(s.transport_facility) === needsTransport);
        }
        setFilteredStudents(result);
    }, [filters, students]);

    useEffect(() => {
        if (showFeesView && selectedStudent) fetchStudentFees(selectedStudent.id);
    }, [showFeesView, selectedStudent]);

    useEffect(() => {
        if (showAttendanceView && selectedStudent) fetchStudentAttendance(selectedStudent.id, attendanceMonth);
    }, [showAttendanceView, attendanceMonth, selectedStudent]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleStudentClick = (student) => {
        setSelectedStudent(student);
        setShowDetailsModal(true);
    };

    const handleEditClick = () => {
        if (!selectedStudent) return;
        setShowDetailsModal(false);

        // Date formatting logic from Students.jsx
        let dobValue = '';
        if (selectedStudent.dob) {
            const separatorPattern = /^(\d{2})[/-](\d{2})[/-](\d{4})/;
            const match = selectedStudent.dob.match(separatorPattern);
            if (match) {
                dobValue = match[1] + match[2] + match[3];
            } else {
                const date = new Date(selectedStudent.dob);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    dobValue = `${day}${month}${year}`;
                } else {
                    const digitsOnly = selectedStudent.dob.replace(/\D/g, '');
                    dobValue = digitsOnly.length > 8 ? digitsOnly.substring(0, 8) : digitsOnly;
                }
            }
        }

        setFormData({
            name: selectedStudent.name || '',
            class: selectedStudent.class || '',
            section: selectedStudent.section || '',
            roll_no: selectedStudent.roll_no || '',
            dob: dobValue,
            gender: selectedStudent.gender || '',
            father_name: selectedStudent.father_name || '',
            mother_name: selectedStudent.mother_name || '',
            mobile: selectedStudent.mobile || '',
            email: selectedStudent.email || '',
            address: selectedStudent.address || '',
            transport_facility: selectedStudent.transport_facility ? 'true' : 'false',
            monthly_fees: selectedStudent.monthly_fees || '',
            transport_fees: selectedStudent.transport_fees || '',
            photo: null
        });
        setPreviewPhoto(selectedStudent.photo_url);
        setViewMode('edit');
    };

    const handleDeleteClick = async () => {
        if (!selectedStudent || !window.confirm(`Are you sure you want to delete ${selectedStudent.name}?`)) return;
        setLoading(true);
        setShowDetailsModal(false);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/student/delete/${selectedStudent.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Student deleted successfully');
            fetchStudents();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete student');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                let value = formData[key];
                if (key === 'dob' && value) {
                    const ddmmyyyyRawPattern = /^(\d{2})(\d{2})(\d{4})$/;
                    const matchRaw = value.match(ddmmyyyyRawPattern);
                    if (matchRaw) value = `${matchRaw[3]}-${matchRaw[2]}-${matchRaw[1]}`;
                }
                data.append(key, value);
            });

            const token = localStorage.getItem('token');
            if (viewMode === 'add') {
                await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/add`, data, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Student added successfully');
            } else {
                await axios.put(`${API_ENDPOINTS.PRINCIPAL}/student/update/${selectedStudent.id}`, data, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Student updated successfully');
            }
            setViewMode('list');
            fetchStudents();
            setFormData(initialFormState);
            setPreviewPhoto(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving student');
        } finally {
            setLoading(false);
        }
    };

    const renderFeesHistory = () => {
        if (!feeHistory) return <div className="loading-spinner">Loading fees...</div>;
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyRecords = (feeHistory.activated_months || []).map(m => {
            const payment = (feeHistory.payments || []).find(p => p.month === m.month && p.year === m.year);
            return { month: m.month, year: m.year, status: payment ? 'paid' : 'pending', paid_at: payment?.paid_at, method: payment?.payment_method };
        });

        return (
            <div className="fees-history-embedded animate-fade-in">
                <div className="fees-columns-container">
                    <div className="fees-column-box monthly">
                        <div className="column-header"><h3>Monthly Fees</h3></div>
                        <div className="column-scroll-area">
                            {monthlyRecords.map((r, i) => (
                                <div key={i} className={`mini-fee-card-v2 ${r.status}`}>
                                    <div className="fee-card-main">
                                        <div className="m-info"><span className="m-name">{months[r.month - 1]} {r.year}</span></div>
                                        <div className={`status-tag ${r.status}`}>{r.status.toUpperCase()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="fees-column-box onetime">
                        <div className="column-header"><h3>One-Time Fees</h3></div>
                        <div className="column-scroll-area">
                            {(feeHistory.one_time_fees || []).map((f, i) => (
                                <div key={i} className={`mini-fee-card-v2 ${f.status}`}>
                                    <div className="fee-card-main">
                                        <div className="m-info"><span className="m-name">{f.reason}</span></div>
                                        <div className={`status-tag ${f.status}`}>{f.status.toUpperCase()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAttendanceCalendar = () => {
        const year = attendanceMonth.getFullYear();
        const month = attendanceMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const days = [];
        for (let i = 0; i < firstDayOfMonth; i++) days.push({ isEmpty: true });
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const att = attendanceData.find(a => a.date === dateStr);
            days.push({ day: i, status: att?.status || null, isEmpty: false });
        }
        const changeMonth = (offset) => {
            const newDate = new Date(attendanceMonth);
            newDate.setMonth(newDate.getMonth() + offset);
            setAttendanceMonth(newDate);
        };

        return (
            <div className="attendance-history-embedded animate-fade-in">
                <div className="attendance-split-layout">
                    <div className="attendance-calendar-side">
                        <div className="attendance-calendar-header">
                            <div className="month-nav">
                                <button onClick={() => changeMonth(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                                <h3>{attendanceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                                <button onClick={() => changeMonth(1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
                            </div>
                        </div>
                        <div className="calendar-mini-grid">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="grid-day-head">{d}</div>)}
                            {days.map((day, i) => <div key={i} className={`grid-day ${day.isEmpty ? 'empty' : ''} ${day.status || ''}`}>{day.day}</div>)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderForm = () => {
        return (
            <form onSubmit={handleSubmit} className="add-student-form form-in-modal">
                <div className="form-section">
                    <h3>Basic Details</h3>
                    <div className="form-grid">
                        <div className="form-group photo-upload-group">
                            <div className="photo-preview">
                                {previewPhoto ? <img src={previewPhoto} alt="Preview" /> : <div className="placeholder"><span>Photo</span></div>}
                            </div>
                            <input type="file" accept="image/*" onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    setFormData(prev => ({ ...prev, photo: file }));
                                    const reader = new FileReader();
                                    reader.onloadend = () => setPreviewPhoto(reader.result);
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </div>
                        <div className="form-group">
                            <label>Full Name *</label>
                            <input type="text" name="name" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Class *</label>
                            <input type="text" name="class" value={formData.class} onChange={(e) => setFormData(p => ({...p, class: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Section *</label>
                            <input type="text" name="section" value={formData.section} onChange={(e) => setFormData(p => ({...p, section: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Roll No *</label>
                            <input type="text" name="roll_no" value={formData.roll_no} onChange={(e) => setFormData(p => ({...p, roll_no: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>DOB (DDMMYYYY) *</label>
                            <input type="text" name="dob" value={formData.dob} onChange={(e) => setFormData(p => ({...p, dob: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Gender *</label>
                            <select name="gender" value={formData.gender} onChange={(e) => setFormData(p => ({...p, gender: e.target.value}))} required>
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-section">
                    <h3>Parent Details</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Father's Name *</label>
                            <input type="text" name="father_name" value={formData.father_name} onChange={(e) => setFormData(p => ({...p, father_name: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Mother's Name *</label>
                            <input type="text" name="mother_name" value={formData.mother_name} onChange={(e) => setFormData(p => ({...p, mother_name: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Mobile *</label>
                            <input type="tel" name="mobile" value={formData.mobile} onChange={(e) => setFormData(p => ({...p, mobile: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Email *</label>
                            <input type="email" name="email" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} required />
                        </div>
                    </div>
                </div>
                <div className="form-section">
                    <h3>Financials & Address</h3>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Address *</label>
                            <textarea name="address" value={formData.address} onChange={(e) => setFormData(p => ({...p, address: e.target.value}))} required rows="2" />
                        </div>
                        <div className="form-group">
                            <label>Monthly Fees</label>
                            <input type="number" name="monthly_fees" value={formData.monthly_fees} onChange={(e) => setFormData(p => ({...p, monthly_fees: e.target.value}))} />
                        </div>
                        <div className="form-group">
                            <label>Transport Facility</label>
                            <div className="modern-toggle-container" onClick={() => setFormData(p => ({ ...p, transport_facility: p.transport_facility === 'true' ? 'false' : 'true' }))}>
                                <div className={`modern-toggle-track ${formData.transport_facility === 'true' ? 'active' : ''}`}><div className="modern-toggle-thumb"></div></div>
                                <span className="toggle-label">{formData.transport_facility === 'true' ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                        {formData.transport_facility === 'true' && (
                            <div className="form-group">
                                <label>Transport Fees</label>
                                <input type="number" name="transport_fees" value={formData.transport_fees} onChange={(e) => setFormData(p => ({...p, transport_fees: e.target.value}))} />
                            </div>
                        )}
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => {
                        setViewMode('list');
                        setFormData(initialFormState);
                        setPreviewPhoto(null);
                    }}>Cancel</button>
                    <button type="submit" className="btn-submit" disabled={loading}>{loading ? 'Saving...' : (viewMode === 'edit' ? 'Update' : 'Add Student')}</button>
                </div>
            </form>
        );
    };

    return (
        <div className="students-page">
            <div className="page-header">
                <div className="header-title-container">
                    <button className="back-to-dash-btn" onClick={() => navigate('/teacher-dashboard')} title="Back">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                    <h2>Student List</h2>
                    <span className="total-count-pill">{students.length} Total</span>
                </div>
                <div className="header-actions">
                    <button className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>View Students</button>
                    <button className={`tab-btn ${viewMode === 'add' ? 'active' : ''}`} onClick={() => { setFormData(initialFormState); setPreviewPhoto(null); setViewMode('add'); }}>Add Student</button>
                </div>
            </div>

            <div className="page-content">
                {viewMode === 'list' ? (
                    <div className="students-list-container">
                        <div className="filters-bar">
                            <input type="text" name="class" placeholder="Filter by Class" value={filters.class} onChange={handleFilterChange} className="filter-input" />
                            <input type="text" name="section" placeholder="Section" value={filters.section} onChange={handleFilterChange} className="filter-input" />
                            <input type="text" name="roll_no" placeholder="Roll No" value={filters.roll_no} onChange={handleFilterChange} className="filter-input" />
                            <select name="transport" value={filters.transport} onChange={handleFilterChange} className="filter-input">
                                <option value="">All Transport</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                        {loading ? <div className="loading-spinner">Loading...</div> : (
                            <div className="table-responsive">
                                                            <table className="students-table">
                                                                <thead><tr><th>Photo</th><th>Name</th><th>Class - Section</th><th>Roll No</th><th>Monthly Fees</th><th>Transport Fees</th><th>Mobile</th><th>Email</th></tr></thead>
                                                                <tbody>
                                                                    {filteredStudents.map(student => (
                                                                        <tr key={student.id} onClick={() => handleStudentClick(student)} className="clickable-row">
                                                                            <td><img src={student.photo_url || 'https://via.placeholder.com/40'} alt="" className="student-table-photo" /></td>
                                                                            <td>{student.name}</td>
                                                                            <td>{student.class} - {student.section}</td>
                                                                            <td>{student.roll_no}</td>
                                                                            <td>₹{student.monthly_fees || 0}</td>
                                                                            <td>{student.transport_facility ? `₹${student.transport_fees || 0}` : 'N/A'}</td>
                                                                            <td>{student.mobile}</td>
                                                                            <td>{student.email}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>                            </div>
                        )}
                    </div>
                ) : (
                    <div className="add-student-container">
                        {renderForm()}
                    </div>
                )}
            </div>

            {showDetailsModal && selectedStudent && (
                <div className="student-modal-overlay" onClick={() => { setShowDetailsModal(false); setShowAttendanceView(false); setShowFeesView(false); }}>
                    <div className="student-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => { setShowDetailsModal(false); setShowAttendanceView(false); setShowFeesView(false); }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <div className="modal-body-premium">
                            <div className="modal-main-details">
                                <div className="modal-header-section">
                                    <div className="modal-photo-wrapper">
                                        <img src={selectedStudent.photo_url || 'https://via.placeholder.com/150'} alt={selectedStudent.name} />
                                        <div className="modal-photo-ring"></div>
                                    </div>
                                    <div className="modal-intro">
                                        <h2 className="modal-student-name">{selectedStudent.name}</h2>
                                        <div className="modal-meta-row">
                                            <div className="modal-id-badge">
                                                <span className="badge-label">Unique Code</span>
                                                <span className="badge-value">{selectedStudent.unique_code}</span>
                                            </div>
                                            <div className="modal-quick-nav-btns">
                                                <button className={`nav-pill-btn attendance ${showAttendanceView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(!showAttendanceView); setShowFeesView(false); }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                    Attendance
                                                </button>
                                                <button className={`nav-pill-btn fees ${showFeesView ? 'active' : ''}`} onClick={() => { setShowFeesView(!showFeesView); setShowAttendanceView(false); }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M16 14v4M12 14v4M8 14v4"/></svg>
                                                    Fees History
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-quick-actions">
                                        <button className="modal-action-btn edit" onClick={handleEditClick} title="Edit Profile">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button className="modal-action-btn delete" onClick={handleDeleteClick} title="Delete Student">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="modal-info-grid">
                                    {showAttendanceView ? (
                                        <div className="info-group-box full attendance-container-box">
                                            <label>Attendance History</label>
                                            {renderAttendanceCalendar()}
                                        </div>
                                    ) : showFeesView ? (
                                        <div className="info-group-box full fees-container-box">
                                            <label>Fees History</label>
                                            {renderFeesHistory()}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="info-group-box">
                                                <label>Academic Info</label>
                                                <div className="info-row-item"><span className="info-label">Class & Section</span><span className="info-value highlight">{selectedStudent.class} - {selectedStudent.section}</span></div>
                                                <div className="info-row-item"><span className="info-label">Roll No</span><span className="info-value">{selectedStudent.roll_no}</span></div>
                                                <div className="info-row-item"><span className="info-label">DOB</span><span className="info-value">{selectedStudent.dob}</span></div>
                                            </div>
                                            <div className="info-group-box">
                                                <label>Family Details</label>
                                                <div className="info-row-item"><span className="info-label">Father</span><span className="info-value">{selectedStudent.father_name}</span></div>
                                                <div className="info-row-item"><span className="info-label">Mother</span><span className="info-value">{selectedStudent.mother_name}</span></div>
                                                <div className="info-row-item"><span className="info-label">Mobile</span><span className="info-value">{selectedStudent.mobile}</span></div>
                                            </div>
                                            <div className="info-group-box">
                                                <label>Finance & Address</label>
                                                <div className="info-row-item"><span className="info-label">Monthly Fees</span><span className="info-value currency">₹{selectedStudent.monthly_fees || 0}</span></div>
                                                <div className="info-row-item"><span className="info-label">Transport</span><span className="info-value">{selectedStudent.transport_facility ? `Enabled (₹${selectedStudent.transport_fees || 0})` : 'None'}</span></div>
                                                <div className="info-row-item address"><span className="info-label">Address</span><span className="info-value">{selectedStudent.address}</span></div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'edit' && (
                <div className="student-modal-overlay" onClick={() => { setViewMode('list'); setFormData(initialFormState); setPreviewPhoto(null); }}>
                    <div className="student-modal-content edit-modal-size" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => { setViewMode('list'); setFormData(initialFormState); setPreviewPhoto(null); }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <div className="modal-main-details">
                            <div className="modal-header-section minimal"><h2 className="modal-student-name">Edit: {selectedStudent?.name}</h2></div>
                            <div className="modal-scrollable-form">{renderForm()}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherStudents;