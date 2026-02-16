import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { explainCode } from '../utils/codeHelper';
import './StudentProfileModal.css';

const StudentProfileModal = ({ isOpen, onClose, userData, onUpdate, onSwitchAccount }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({});
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                email: userData.email || '',
                mobile: userData.mobile || '',
                dob: userData.dob || '',
                gender: userData.gender || 'Male',
                father_name: userData.father_name || '',
                mother_name: userData.mother_name || '',
                address: userData.address || '',
                transport_facility: userData.transport_facility ? 'true' : 'false'
            });
            setPreviewImage(userData.photo_url);
        }
    }, [userData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Editing is disabled for students as per requirements
    };

    return (
        <div className="s-modal-overlay" onClick={onClose}>
            <div className="s-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Sidebar */}
                <aside className="s-modal-sidebar">
                    <div className="s-sidebar-top">
                        <div className="s-profile-img-preview">
                            <img src={userData.photo_url || 'https://via.placeholder.com/150'} alt="Profile" />
                        </div>
                        <div className="s-view-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            Verified Profile
                        </div>
                    </div>

                    <div className="s-sidebar-actions">
                        <button className="s-switch-btn" onClick={() => { onSwitchAccount(); onClose(); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18" /></svg>
                            Switch Account
                        </button>
                    </div>

                    <div className="s-sidebar-footer">
                        <p>Academic ID</p>
                        <span className="s-inst-name-mini unique-code-text" title={explainCode(userData.unique_code)}>{userData.unique_code}</span>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="s-modal-main">
                    <header className="s-main-header">
                        <div className="s-title-group">
                            <h2>Detailed Profile</h2>
                            <p className="s-view-only-hint">Information verified by administration</p>
                        </div>
                        <div className="s-header-actions">
                            <button className="s-close-btn" onClick={onClose}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </header>

                    <div className="s-main-body">
                        <div className="s-info-grid">
                            <div className="s-info-item">
                                <label>Email Address</label>
                                <p>{userData.email || 'N/A'}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Mobile Number</label>
                                <p>{userData.mobile || 'N/A'}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Father's Name</label>
                                <p>{userData.father_name || 'N/A'}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Mother's Name</label>
                                <p>{userData.mother_name || 'N/A'}</p>
                            </div>

                            <div className="s-info-item.full-width">
                                <label>Residential Address</label>
                                <p>{userData.address || 'N/A'}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Date of Birth</label>
                                <p>{userData.dob || 'N/A'}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Gender</label>
                                <p>{userData.gender}</p>
                            </div>

                            <div className="s-info-item">
                                <label>Transport Facility</label>
                                <p>{userData.transport_facility ? '✅ Yes' : '❌ No'}</p>
                            </div>
                        </div>

                        <div className="s-notice-box">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            <p>To update any of these details, please submit a physical application to the school office. Some records like Unique ID and Transport status are permanent.</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentProfileModal;
