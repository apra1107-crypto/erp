import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { explainCode } from '../utils/codeHelper';
import './Students.css';

const Students = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('view'); // 'view' or 'add'
    const [viewMode, setViewMode] = useState('list'); // 'list', 'details', 'edit'
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        class: '',
        section: '',
        roll_no: '',
        transport: ''
    });

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
        photo: null
    };

    const [formData, setFormData] = useState(initialFormState);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    useEffect(() => {
        if (activeTab === 'view') {
            fetchStudents();
        }
    }, [activeTab]);

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
            // toast.error('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleStudentClick = (student) => {
        setSelectedStudent(student);
        setViewMode('details');
    };

    const handleBackToList = () => {
        setViewMode('list');
        setSelectedStudent(null);
    };

    const handleEditClick = () => {
        if (!selectedStudent) return;

        // Populate form with student data
        let dobValue = '';
        if (selectedStudent.dob) {
            // Handle common formats: DD/MM/YYYY or DD-MM-YYYY
            const separatorPattern = /^(\d{2})[/-](\d{2})[/-](\d{4})/;
            const match = selectedStudent.dob.match(separatorPattern);

            if (match) {
                // Remove separators for DDMMYYYY display
                dobValue = match[1] + match[2] + match[3];
            } else {
                // Try parsing as ISO or standard date
                const date = new Date(selectedStudent.dob);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    dobValue = `${day}${month}${year}`;
                } else {
                    // Fallback to removing all non-digits, but only if it's not a long ISO string
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
            photo: null
        });
        setPreviewPhoto(selectedStudent.photo_url);
        setViewMode('edit');
    };

    const handleDeleteClick = async () => {
        if (!selectedStudent || !window.confirm(`Are you sure you want to delete ${selectedStudent.name}? THIS ACTION CANNOT BE UNDONE.`)) return;

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/student/delete/${selectedStudent.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Student deleted successfully');
            fetchStudents();
            handleBackToList();
        } catch (error) {
            console.error('Delete student error:', error);
            toast.error(error.response?.data?.message || 'Failed to delete student');
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
                await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/add`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Student added successfully!');
                setFormData(initialFormState);
                setPreviewPhoto(null);
                setActiveTab('view');
            } else if (viewMode === 'edit' && selectedStudent) {
                await axios.put(`${API_ENDPOINTS.PRINCIPAL}/student/update/${selectedStudent.id}`, data, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success('Student updated successfully!');
                fetchStudents();
                setViewMode('list');
                setSelectedStudent(null);
            }

        } catch (error) {
            console.error('Student save error:', error);
            toast.error(error.response?.data?.message || 'Failed to save student');
        } finally {
            setLoading(false);
        }
    };

    function renderForm() {
        return (
            <form onSubmit={handleSubmit} className="add-student-form">
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
                            <label>Class *</label>
                            <input
                                type="text"
                                name="class"
                                value={formData.class}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Section *</label>
                            <input
                                type="text"
                                name="section"
                                value={formData.section}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Roll Number *</label>
                            <input
                                type="text"
                                name="roll_no"
                                value={formData.roll_no}
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
                    <h3>Parent Details</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Father's Name *</label>
                            <input
                                type="text"
                                name="father_name"
                                value={formData.father_name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Mother's Name *</label>
                            <input
                                type="text"
                                name="mother_name"
                                value={formData.mother_name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Contact Mobile *</label>
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
                            <label>Transport Facility</label>
                            <select
                                name="transport_facility"
                                value={formData.transport_facility}
                                onChange={handleInputChange}
                            >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={() => {
                        if (viewMode === 'edit') setViewMode('details');
                        else setActiveTab('view');
                    }}>Cancel</button>
                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Saving...' : (viewMode === 'edit' ? 'Update Student' : 'Add Student')}
                    </button>
                </div>
            </form>
        );
    }

    return (
        <div className="students-page">
            <div className="page-header">
                <h2>Student Management</h2>
                <div className="header-actions">
                    <button
                        className={`tab-btn ${activeTab === 'view' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('view');
                            setViewMode('list');
                            setSelectedStudent(null);
                        }}
                    >
                        View Students
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
                        Add Student
                    </button>
                </div>
            </div>

            <div className="page-content">
                {activeTab === 'view' ? (
                    <>
                        {viewMode === 'list' && (
                            <div className="students-list-container">
                                <div className="filters-bar">
                                    <input
                                        type="text"
                                        name="class"
                                        placeholder="Filter by Class"
                                        value={filters.class}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                    />
                                    <input
                                        type="text"
                                        name="section"
                                        placeholder="Section"
                                        value={filters.section}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                    />
                                    <input
                                        type="text"
                                        name="roll_no"
                                        placeholder="Roll No"
                                        value={filters.roll_no}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                    />
                                    <select
                                        name="transport"
                                        value={filters.transport}
                                        onChange={handleFilterChange}
                                        className="filter-input"
                                        style={{ minWidth: '180px' }}
                                    >
                                        <option value="">All Transport Modes</option>
                                        <option value="yes">Transport: Yes</option>
                                        <option value="no">Transport: No</option>
                                    </select>
                                </div>

                                {loading ? (
                                    <div className="loading-spinner">Loading...</div>
                                ) : filteredStudents.length === 0 ? (
                                    <div className="empty-state">No students found matching filters</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="students-table">
                                            <thead>
                                                <tr>
                                                    <th>Photo</th>
                                                    <th>Name</th>
                                                    <th>Class - Section</th>
                                                    <th>Roll No</th>
                                                    <th>Unique Code</th>
                                                    <th>Mobile</th>
                                                    <th>Email</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStudents.map(student => (
                                                    <tr key={student.id} onClick={() => handleStudentClick(student)} className="clickable-row">
                                                        <td>
                                                            <img
                                                                src={student.photo_url || 'https://via.placeholder.com/40'}
                                                                alt={student.name}
                                                                className="student-table-photo"
                                                            />
                                                        </td>
                                                        <td>{student.name}</td>
                                                        <td>{student.class} - {student.section}</td>
                                                        <td>{student.roll_no}</td>
                                                        <td className="unique-code-text" title={explainCode(student.unique_code)}>{student.unique_code}</td>
                                                        <td>{student.mobile}</td>
                                                        <td>{student.email}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === 'details' && selectedStudent && (
                            <div className="student-details-view">
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
                                        <img src={selectedStudent.photo_url || 'https://via.placeholder.com/100'} alt={selectedStudent.name} className="details-photo" />
                                        <div className="details-title">
                                            <h2>{selectedStudent.name}</h2>
                                            <p className="subtitle unique-code-text" title={explainCode(selectedStudent.unique_code)}>{selectedStudent.unique_code}</p>
                                        </div>
                                    </div>
                                    <div className="details-grid">
                                        <div className="detail-item">
                                            <label>Class - Section</label>
                                            <p>{selectedStudent.class} - {selectedStudent.section}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Roll Number</label>
                                            <p>{selectedStudent.roll_no}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Gender</label>
                                            <p>{selectedStudent.gender}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Date of Birth</label>
                                            <p>{selectedStudent.dob}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Father's Name</label>
                                            <p>{selectedStudent.father_name}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Mother's Name</label>
                                            <p>{selectedStudent.mother_name}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Mobile</label>
                                            <p>{selectedStudent.mobile}</p>
                                        </div>
                                        <div className="detail-item">
                                            <label>Email</label>
                                            <p>{selectedStudent.email}</p>
                                        </div>
                                        <div className="detail-item full"><label>Address</label><p>{selectedStudent.address}</p></div>
                                        <div className="detail-item"><label>Transport</label><p>{selectedStudent.transport_facility ? 'Yes' : 'No'}</p></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {viewMode === 'edit' && (
                            <div className="add-student-container">
                                <div className="edit-header">
                                    <h3>Edit Student: {selectedStudent?.name}</h3>
                                    <button className="btn-cancel-sm" onClick={() => setViewMode('details')}>Cancel Edit</button>
                                </div>
                                {renderForm()}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="add-student-container">
                        {renderForm()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Students;
