import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { explainCode } from '../utils/codeHelper';
import './Teachers.css';

const Teachers = () => {
    const [activeTab, setActiveTab] = useState('view'); // 'view' or 'add'
    const [viewMode, setViewMode] = useState('list'); // 'list', 'details', 'edit'
    const [teachers, setTeachers] = useState([]);
    const [filteredTeachers, setFilteredTeachers] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [loading, setLoading] = useState(false);

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
        if (activeTab === 'view') {
            fetchTeachers();
        }
    }, [activeTab]);

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
            // toast.error('Failed to fetch teachers');
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
        setViewMode('details');
    };

    const handleBackToList = () => {
        setViewMode('list');
        setSelectedTeacher(null);
    };

    const handleEditClick = () => {
        if (!selectedTeacher) return;

        let dobValue = '';
        if (selectedTeacher.dob) {
            // Handle common formats: DD/MM/YYYY or DD-MM-YYYY
            const separatorPattern = /^(\d{2})[/-](\d{2})[/-](\d{4})/;
            const match = selectedTeacher.dob.match(separatorPattern);

            if (match) {
                // Remove separators for DDMMYYYY display
                dobValue = match[1] + match[2] + match[3];
            } else {
                // Try parsing as ISO or standard date
                const date = new Date(selectedTeacher.dob);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    dobValue = `${day}${month}${year}`;
                } else {
                    // Fallback to removing all non-digits, but only if it's not a long ISO string
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
        if (!selectedTeacher || !window.confirm(`Are you sure you want to delete ${selectedTeacher.name}? THIS ACTION CANNOT BE UNDONE.`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/teacher/delete/${selectedTeacher.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Teacher deleted successfully');
            fetchTeachers();
            handleBackToList();
        } catch (error) {
            console.error('Delete teacher error:', error);
            toast.error(error.response?.data?.message || 'Failed to delete teacher');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, photo: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewPhoto(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                let value = formData[key];
                // Convert DOB to YYYY-MM-DD for backend
                if (key === 'dob' && value) {
                    // Try DD-MM-YYYY
                    const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
                    const match = value.match(ddmmyyyyPattern);
                    if (match) {
                        value = `${match[3]}-${match[2]}-${match[1]}`;
                    } else {
                        // Try DDMMYYYY (8 digits)
                        const ddmmyyyyRawPattern = /^(\d{2})(\d{2})(\d{4})$/;
                        const matchRaw = value.match(ddmmyyyyRawPattern);
                        if (matchRaw) {
                            value = `${matchRaw[3]}-${matchRaw[2]}-${matchRaw[1]}`;
                        }
                    }
                }
                data.append(key, value);
            });

            const token = localStorage.getItem('token');

            if (activeTab === 'add') {
                await axios.post(`${API_ENDPOINTS.PRINCIPAL}/teacher/add`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Teacher added successfully!');
                setFormData(initialFormState);
                setPreviewPhoto(null);
                setActiveTab('view');
            } else if (viewMode === 'edit' && selectedTeacher) {
                await axios.put(`${API_ENDPOINTS.PRINCIPAL}/teacher/update/${selectedTeacher.id}`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Teacher updated successfully!');
                fetchTeachers();
                setViewMode('list');
                setSelectedTeacher(null);
            }

        } catch (error) {
            console.error('Teacher save error:', error);
            toast.error(error.response?.data?.message || 'Failed to save teacher');
        } finally {
            setLoading(false);
        }
    };

    function renderForm() {
        return (
            <form onSubmit={handleSubmit} className="add-teacher-form">
                <div className="form-section">
                    <h3>Basic Details</h3>
                    <div className="form-grid">
                        <div className="form-group photo-upload-group">
                            <div className="photo-preview">
                                {previewPhoto ? (
                                    <img src={previewPhoto} alt="Preview" />
                                ) : (
                                    <div className="placeholder">
                                        <span>Photo</span>
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Full Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Date of Birth (DDMMYYYY) *</label>
                            <input
                                type="text"
                                name="dob"
                                value={formData.dob}
                                onChange={handleInputChange}
                                placeholder="DDMMYYYY or DD-MM-YYYY"
                                pattern="(\d{8})|(\d{2}-\d{2}-\d{4})"
                                title="Date should be in DDMMYYYY or DD-MM-YYYY format"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Gender *</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleInputChange}
                                required
                            >
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
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Qualification *</label>
                            <input
                                type="text"
                                name="qualification"
                                value={formData.qualification}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Mobile *</label>
                            <input
                                type="tel"
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Other Details</h3>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Address *</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required
                                rows="3"
                            />
                        </div>
                        <div className="form-group">
                            <label>Special Permission</label>
                            <select
                                name="special_permission"
                                value={formData.special_permission}
                                onChange={handleInputChange}
                            >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                            <small className="text-secondary">If yes, teacher can access advanced features.</small>
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => {
                        if (viewMode === 'edit') setViewMode('details');
                        else setActiveTab('view');
                    }}>Cancel</button>
                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Saving...' : (viewMode === 'edit' ? 'Update Teacher' : 'Add Teacher')}
                    </button>
                </div>
            </form>
        );
    }

    return (
        <div className="teachers-page">
            <div className="page-header">
                <h2>Teacher Management</h2>
                <div className="header-actions">
                    <button
                        className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('view');
                            setViewMode('list');
                            setSelectedTeacher(null);
                        }}
                    >
                        View Teachers
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('add');
                            setViewMode('list');
                            setFormData(initialFormState);
                            setPreviewPhoto(null);
                        }}
                    >
                        Add Teacher
                    </button>
                </div>
            </div>

            <div className="page-content">
                {activeTab === 'view' ? (
                    <>
                        {viewMode === 'list' && (
                            <div className="teachers-list-container">
                                <div className="filters-bar">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Filter by Name"
                                        value={filters.name}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                    />
                                    <input
                                        type="text"
                                        name="subject"
                                        placeholder="Filter by Subject"
                                        value={filters.subject}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                    />
                                </div>

                                {loading ? (
                                    <div className="loading-spinner">Loading...</div>
                                ) : filteredTeachers.length === 0 ? (
                                    <div className="empty-state">No teachers found matching filters</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="teachers-table">
                                            <thead>
                                                <tr>
                                                    <th>Photo</th>
                                                    <th>Name</th>
                                                    <th>Subject</th>
                                                    <th>Unique Code</th>
                                                    <th>Mobile</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTeachers.map(teacher => (
                                                    <tr key={teacher.id} onClick={() => handleTeacherClick(teacher)} className="clickable-row">
                                                        <td>
                                                            <img
                                                                src={teacher.photo_url || 'https://via.placeholder.com/40'}
                                                                alt={teacher.name}
                                                                className="teacher-table-photo"
                                                            />
                                                        </td>
                                                        <td>{teacher.name}</td>
                                                        <td>{teacher.subject}</td>
                                                        <td className="unique-code-text" title={explainCode(teacher.unique_code)}>{teacher.unique_code}</td>
                                                        <td>{teacher.mobile}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === 'details' && selectedTeacher && (
                            <div className="teacher-details-view">
                                <div className="details-header">
                                    <button className="back-btn" onClick={handleBackToList}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                                        Back to List
                                    </button>
                                    <div className="details-actions">
                                        <button className="btn-edit" onClick={handleEditClick}>Edit</button>
                                        <button className="btn-delete" onClick={handleDeleteClick}>Delete</button>
                                    </div>
                                </div>
                                <div className="details-card">
                                    <div className="details-profile-header">
                                        <img src={selectedTeacher.photo_url || 'https://via.placeholder.com/100'} alt={selectedTeacher.name} className="details-photo" />
                                        <div className="details-title">
                                            <h2>{selectedTeacher.name}</h2>
                                            <p className="subtitle unique-code-text" title={explainCode(selectedTeacher.unique_code)}>{selectedTeacher.unique_code}</p>
                                        </div>
                                    </div>
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Subject</label>
                                            <p>{selectedTeacher.subject}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Qualification</label>
                                            <p>{selectedTeacher.qualification}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Gender</label>
                                            <p>{selectedTeacher.gender}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Date of Birth</label>
                                            <p>{selectedTeacher.dob}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Mobile</label>
                                            <p>{selectedTeacher.mobile}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email</label>
                                            <p>{selectedTeacher.email}</p>
                                        </div>
                                        <div className="detail-item full"><label>Address</label><p>{selectedTeacher.address}</p></div>
                                        <div className="detail-item"><label>Special Permission</label><p>{selectedTeacher.special_permission ? 'Yes' : 'No'}</p></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {viewMode === 'edit' && (
                            <div className="add-teacher-container">
                                <div className="edit-header">
                                    <h3>Edit Teacher: {selectedTeacher?.name}</h3>
                                    <button className="btn-cancel-sm" onClick={() => setViewMode('details')}>Cancel Edit</button>
                                </div>
                                {renderForm()}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="add-teacher-container">
                        {renderForm()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Teachers;
