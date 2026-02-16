import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { useTheme } from '../context/ThemeContext';
import './PrincipalProfileModal.css';

const PrincipalProfileModal = ({ isOpen, onClose, profileData, onUpdate }) => {
    const { theme } = useTheme();
    if (!isOpen) return null;

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(profileData?.principal_photo_url);
    const [previewLogo, setPreviewLogo] = useState(profileData?.logo_url);
    const [formData, setFormData] = useState({
        principal_name: '',
        email: '',
        mobile: '',
        institute_name: '',
        affiliation: '',
        state: '',
        district: '',
        pincode: '',
        landmark: '',
        address: '',
        principal_photo: null,
        logo: null
    });

    useEffect(() => {
        if (profileData && !formData.principal_name) {
            setFormData({
                principal_name: profileData.principal_name || '',
                email: profileData.email || '',
                mobile: profileData.mobile || '',
                institute_name: profileData.institute_name || '',
                affiliation: profileData.affiliation || '',
                state: profileData.state || '',
                district: profileData.district || '',
                pincode: profileData.pincode || '',
                landmark: profileData.landmark || '',
                address: profileData.address || '',
                principal_photo: null,
                logo: null
            });
            setPreviewImage(profileData.principal_photo_url);
            setPreviewLogo(profileData.logo_url);
        }
    }, []);

    const handleBackdropClick = (e) => {
        if (e.target.classList.contains('p-modal-overlay')) onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, principal_photo: file }));
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, logo: file }));
            const reader = new FileReader();
            reader.onloadend = () => setPreviewLogo(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (key === 'principal_photo' && formData[key]) {
                    data.append('principal_photo', formData[key]);
                } else if (key === 'logo' && formData[key]) {
                    data.append('logo', formData[key]);
                } else if (key !== 'principal_photo' && key !== 'logo') {
                    data.append(key, formData[key] || '');
                }
            });

            const token = localStorage.getItem('token');
            const response = await axios.put(`${API_ENDPOINTS.PRINCIPAL}/profile/update`, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.success('Profile updated successfully!');
            onUpdate(response.data.profile);
            setIsEditing(false);
        } catch (error) {
            console.error('Update error:', error);
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`p-modal-overlay theme-${theme}`} onClick={handleBackdropClick}>
            <div className="p-modal-container">
                <div className="p-modal-sidebar">
                    <div className="sidebar-profile">
                        <div className="profile-img-preview">
                            <img src={previewImage || 'https://via.placeholder.com/150'} alt="Profile" />
                            {isEditing && (
                                <label className="img-edit-btn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
                                </label>
                            )}
                        </div>
                        <h3>{formData.principal_name}</h3>
                        <p className="role-text">Principal Account</p>
                    </div>

                    <div className="sidebar-divider"></div>

                    <div className="sidebar-logo-section">
                        <div className="logo-display">
                            <img src={previewLogo || 'https://via.placeholder.com/150'} alt="Institute Logo" />
                            {isEditing && (
                                <label className="logo-edit-btn">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-modal-main">
                    <button className="close-btn-floating" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>

                    <div className="main-body">
                        <div className="info-grid">
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> Full Name</label>
                                {isEditing ? <input name="principal_name" value={formData.principal_name} onChange={handleChange} placeholder="Full Name" /> : <p>{formData.principal_name}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" /></svg> Institute Name</label>
                                {isEditing ? <input name="institute_name" value={formData.institute_name} onChange={handleChange} placeholder="Institute Name" /> : <p>{formData.institute_name}</p>}
                            </div>
                            <div className="info-item full-width">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg> Affiliation</label>
                                {isEditing ? <textarea name="affiliation" value={formData.affiliation} onChange={handleChange} rows="2" placeholder="e.g., An English Medium Co-ed School Affiliated to CBSE Board New Delhi" /> : <p>{formData.affiliation || 'N/A'}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> Email Address</label>
                                {isEditing ? <input name="email" value={formData.email} onChange={handleChange} placeholder="Email" /> : <p>{formData.email}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg> Mobile Number</label>
                                {isEditing ? <input name="mobile" value={formData.mobile} onChange={handleChange} placeholder="Mobile" /> : <p>{formData.mobile}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> State</label>
                                {isEditing ? <input name="state" value={formData.state} onChange={handleChange} placeholder="State" /> : <p>{formData.state || 'N/A'}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> District</label>
                                {isEditing ? <input name="district" value={formData.district} onChange={handleChange} placeholder="District" /> : <p>{formData.district || 'N/A'}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Pincode</label>
                                {isEditing ? <input name="pincode" value={formData.pincode} onChange={handleChange} placeholder="Pincode" /> : <p>{formData.pincode || 'N/A'}</p>}
                            </div>
                            <div className="info-item">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z" /></svg> Landmark</label>
                                {isEditing ? <input name="landmark" value={formData.landmark} onChange={handleChange} placeholder="Landmark" /> : <p>{formData.landmark || 'N/A'}</p>}
                            </div>
                            <div className="info-item full-width">
                                <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> Full Address</label>
                                {isEditing ? <textarea name="address" value={formData.address} onChange={handleChange} rows="2" placeholder="Full Address" /> : <p>{formData.address || 'N/A'}</p>}
                            </div>

                            {/* Action Buttons */}
                            <div className="info-item full-width action-buttons">
                                {!isEditing ? (
                                    <button className="edit-btn-integrated" onClick={() => setIsEditing(true)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        Edit Profile
                                    </button>
                                ) : (
                                    <div className="button-group">
                                        <button className="cancel-btn-integrated" onClick={() => setIsEditing(false)}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                            Cancel
                                        </button>
                                        <button className="save-btn-integrated" onClick={handleSubmit} disabled={loading}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrincipalProfileModal;
