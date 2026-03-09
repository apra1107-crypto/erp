import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { explainCode } from '../utils/codeHelper';
import './Teachers.css';

const Teachers = () => {
    const navigate = useNavigate();
    const { id: paramId } = useParams();
    const [viewMode, setViewMode] = useState('list'); // 'list', 'details', 'edit'
    const [teachers, setTeachers] = useState([]);
    const [filteredTeachers, setFilteredTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        name: '',
        subject: ''
    });

    // Form State
    const initialFormState = {
        name: '',
        dob: '',
        mobile: '',
        email: '',
        subject: '',
        qualification: '',
        gender: '',
        address: '',
        special_permission: 'false',
        photo: null
    };

    const [formData, setFormData] = useState(initialFormState);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    useEffect(() => {
        fetchTeachers();
    }, []);

    // Handle incoming ID from URL params
    useEffect(() => {
        if (paramId && teachers.length > 0) {
            const teacher = teachers.find(t => t.id.toString() === paramId.toString());
            if (teacher) {
                setSelectedTeacher(teacher);
                setShowDetailsModal(true);
            }
        }
    }, [paramId, teachers]);

    useEffect(() => {
        let result = teachers;
        if (filters.name) {
            result = result.filter(t => t.name.toLowerCase().includes(filters.name.toLowerCase()));
        }
        if (filters.subject) {
            result = result.filter(t => t.subject.toLowerCase().includes(filters.subject.toLowerCase()));
        }
        setFilteredTeachers(result);
    }, [filters, teachers]);

    const fetchTeachers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/teacher/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeachers(response.data.teachers || []);
            setFilteredTeachers(response.data.teachers || []);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleTeacherClick = (teacher) => {
        setSelectedTeacher(teacher);
        setShowDetailsModal(true);
    };

    const handleEditClick = () => {
        if (!selectedTeacher) return;
        setShowDetailsModal(false);

        let dobValue = '';
        if (selectedTeacher.dob) {
            const separatorPattern = /^(\d{2})[/-](\d{2})[/-](\d{4})/;
            const match = selectedTeacher.dob.match(separatorPattern);
            if (match) {
                dobValue = match[1] + match[2] + match[3];
            } else {
                const date = new Date(selectedTeacher.dob);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    dobValue = `${day}${month}${year}`;
                } else {
                    const digitsOnly = selectedTeacher.dob.replace(/\D/g, '');
                    dobValue = digitsOnly.length > 8 ? digitsOnly.substring(0, 8) : digitsOnly;
                }
            }
        }

        setFormData({
            name: selectedTeacher.name || '',
            dob: dobValue,
            mobile: selectedTeacher.mobile || '',
            email: selectedTeacher.email || '',
            subject: selectedTeacher.subject || '',
            qualification: selectedTeacher.qualification || '',
            gender: selectedTeacher.gender || '',
            address: selectedTeacher.address || '',
            special_permission: selectedTeacher.special_permission ? 'true' : 'false',
            photo: null
        });
        setPreviewPhoto(selectedTeacher.photo_url);
        setViewMode('edit');
    };

    const handleDeleteClick = async () => {
        if (!selectedTeacher || !window.confirm(`Are you sure you want to delete ${selectedTeacher.name}?`)) return;
        setLoading(true);
        setShowDetailsModal(false);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/teacher/delete/${selectedTeacher.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Teacher deleted successfully');
            fetchTeachers();
        } catch (error) {
            toast.error('Failed to delete teacher');
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
            if (showAddModal) {
                await axios.post(`${API_ENDPOINTS.PRINCIPAL}/teacher/add`, data, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Teacher added successfully!');
                setShowAddModal(false);
            } else {
                await axios.put(`${API_ENDPOINTS.PRINCIPAL}/teacher/update/${selectedTeacher.id}`, data, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Teacher updated successfully!');
                setViewMode('list');
            }
            fetchTeachers();
            setFormData(initialFormState);
            setPreviewPhoto(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving teacher');
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => {
        const isEditing = viewMode === 'edit';
        const isAdding = showAddModal;
        return (
            <form onSubmit={handleSubmit} className="add-teacher-form form-in-modal">
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
                            <label>DOB (DDMMYYYY) *</label>
                            <input type="text" name="dob" value={formData.dob} onChange={(e) => setFormData(p => ({...p, dob: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Gender *</label>
                            <select name="gender" value={formData.gender} onChange={(e) => setFormData(p => ({...p, gender: e.target.value}))} required>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-section">
                    <h3>Professional Details</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Subject *</label>
                            <input type="text" name="subject" value={formData.subject} onChange={(e) => setFormData(p => ({...p, subject: e.target.value}))} required />
                        </div>
                        <div className="form-group">
                            <label>Qualification *</label>
                            <input type="text" name="qualification" value={formData.qualification} onChange={(e) => setFormData(p => ({...p, qualification: e.target.value}))} required />
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
                    <h3>Other Details</h3>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Address *</label>
                            <textarea name="address" value={formData.address} onChange={(e) => setFormData(p => ({...p, address: e.target.value}))} required rows="2" />
                        </div>
                        <div className="form-group">
                            <label>Special Permission</label>
                            <select name="special_permission" value={formData.special_permission} onChange={(e) => setFormData(p => ({...p, special_permission: e.target.value}))}>
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => {
                        if (isEditing) { setViewMode('list'); setShowDetailsModal(true); }
                        else setShowAddModal(false);
                    }}>Cancel</button>
                    <button type="submit" className="btn-submit" disabled={loading}>{loading ? 'Saving...' : (isEditing ? 'Update' : 'Add')}</button>
                </div>
            </form>
        );
    };

    return (
        <div className="teachers-page">
            <div className="page-header">
                <div className="header-title-container">
                    <button className="back-to-dash-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h2>Teacher Management</h2>
                </div>
                <div className="header-actions">
                    <button className="tab-btn active" onClick={() => setViewMode('list')}>View Teachers</button>
                    <button className="tab-btn" onClick={() => { setFormData(initialFormState); setPreviewPhoto(null); setShowAddModal(true); }}>Add Teacher</button>
                </div>
            </div>

            <div className="page-content">
                <div className="teachers-list-container">
                    <div className="filters-bar">
                        <input type="text" name="name" placeholder="Filter by Name" value={filters.name} onChange={handleFilterChange} className="filter-input" />
                        <input type="text" name="subject" placeholder="Filter by Subject" value={filters.subject} onChange={handleFilterChange} className="filter-input" />
                    </div>
                    {loading ? <div className="loading-spinner">Loading...</div> : (
                        <div className="table-responsive">
                            <table className="teachers-table">
                                <thead><tr><th>Photo</th><th>Name</th><th>Subject</th><th>Unique Code</th><th>Mobile</th></tr></thead>
                                <tbody>
                                    {filteredTeachers.map(teacher => (
                                        <tr key={teacher.id} onClick={() => handleTeacherClick(teacher)} className="clickable-row">
                                            <td><img src={teacher.photo_url || 'https://via.placeholder.com/40'} alt="" className="teacher-table-photo" /></td>
                                            <td>{teacher.name}</td>
                                            <td>{teacher.subject}</td>
                                            <td className="unique-code-text">{teacher.unique_code}</td>
                                            <td>{teacher.mobile}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showDetailsModal && selectedTeacher && (
                <div className="teacher-modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="teacher-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setShowDetailsModal(false)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <div className="modal-body-premium"><div className="modal-main-details">
                            <div className="modal-header-section">
                                <div className="modal-photo-wrapper"><img src={selectedTeacher.photo_url || 'https://via.placeholder.com/150'} alt="" /><div className="modal-photo-ring"></div></div>
                                <div className="modal-intro"><h2 className="modal-student-name">{selectedTeacher.name}</h2><div className="modal-id-badge"><span className="badge-label">Unique Code</span><span className="badge-value">{selectedTeacher.unique_code}</span></div></div>
                                <div className="modal-quick-actions">
                                    <button className="modal-action-btn edit" onClick={handleEditClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                    <button className="modal-action-btn delete" onClick={handleDeleteClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                                </div>
                            </div>
                            <div className="modal-info-grid">
                                <div className="info-group-box"><label>Professional Info</label>
                                    <div className="info-row-item"><span className="info-label">Subject</span><span className="info-value highlight">{selectedTeacher.subject}</span></div>
                                    <div className="info-row-item"><span className="info-label">Qualification</span><span className="info-value">{selectedTeacher.qualification}</span></div>
                                    <div className="info-row-item"><span className="info-label">Gender</span><span className="info-value">{selectedTeacher.gender}</span></div>
                                </div>
                                <div className="info-group-box"><label>Personal Details</label>
                                    <div className="info-row-item"><span className="info-label">DOB</span><span className="info-value">{selectedTeacher.dob}</span></div>
                                    <div className="info-row-item"><span className="info-label">Mobile</span><span className="info-value">{selectedTeacher.mobile}</span></div>
                                    <div className="info-row-item"><span className="info-label">Email</span><span className="info-value">{selectedTeacher.email}</span></div>
                                </div>
                                <div className="info-group-box"><label>Other Details</label>
                                    <div className="info-row-item"><span className="info-label">Special Permission</span><span className="info-value">{selectedTeacher.special_permission ? 'Yes' : 'No'}</span></div>
                                    <div className="info-row-item address"><span className="info-label">Address</span><span className="info-value">{selectedTeacher.address}</span></div>
                                </div>
                            </div>
                        </div></div>
                    </div>
                </div>
            )}

            {(viewMode === 'edit' || showAddModal) && (
                <div className="teacher-modal-overlay" onClick={() => { if (viewMode === 'edit') { setViewMode('list'); setShowDetailsModal(true); } else setShowAddModal(false); }}>
                    <div className="teacher-modal-content edit-modal-size" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => { if (viewMode === 'edit') { setViewMode('list'); setShowDetailsModal(true); } else setShowAddModal(false); }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                        <div className="modal-main-details">
                            <div className="modal-header-section minimal"><h2 className="modal-student-name">{showAddModal ? 'Add Teacher' : `Edit: ${selectedTeacher?.name}`}</h2></div>
                            <div className="modal-scrollable-form">{renderForm()}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Teachers;