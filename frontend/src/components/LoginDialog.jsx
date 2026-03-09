import React, { useState } from 'react';
import './LoginDialog.css';
import InstituteLogin from './InstituteLogin';
import StudentLogin from './StudentLogin';
import TeacherLogin from './TeacherLogin';
import AdminLogin from './AdminLogin';

const LoginDialog = ({ isOpen, onClose }) => {
    const [selectedRole, setSelectedRole] = useState('institute');

    if (!isOpen) return null;

    const roles = [
        { id: 'institute', title: 'Institute Portal', icon: 'M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6', color: 'blue', subtitle: 'For Principals & Owners' },
        { id: 'teacher', title: 'Teacher Portal', icon: 'M16 3.13a4 4 0 0 1 0 7.75M7 19H3v-2a4 4 0 0 1 4-4m14 4h-4v-2a4 4 0 0 0-4-4m1-6a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', color: 'purple', subtitle: 'Manage classes & attendance' },
        { id: 'student', title: 'Student Portal', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A9.916 9.916 0 0012 20.147a9.916 9.916 0 00-6.825-3.09 12.083 12.083 0 01.665-6.479L12 14z', color: 'pink', subtitle: 'View results & homework' },
        { id: 'admin', title: 'Super Admin', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', color: 'orange', subtitle: 'System administration' }
    ];

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="login-overlay" onClick={handleOverlayClick}>
            <div className="login-modal-wrapper">
                <button className="modal-close-icon" onClick={onClose} aria-label="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <div className="login-dual-layout">
                    {/* Left Side: Role Navigation */}
                    <div className="login-role-sidebar">
                        <div className="sidebar-branding">
                            <h2 className="brand-text">Klass<span className="logo-accent">in</span></h2>
                            <p className="login-hint">Select Workspace</p>
                        </div>

                        <div className="role-nav-container">
                            {roles.map((role) => (
                                <div 
                                    key={role.id} 
                                    className={`role-nav-card ${selectedRole === role.id ? 'active' : ''}`}
                                    onClick={() => setSelectedRole(role.id)}
                                >
                                    <div className={`role-card-icon ${role.color}`}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d={role.icon} />
                                        </svg>
                                    </div>
                                    <div className="role-card-text">
                                        <span className="role-card-label">{role.title}</span>
                                        <span className="role-card-subtitle">{role.subtitle}</span>
                                    </div>
                                    {selectedRole === role.id && <div className="selection-indicator"></div>}
                                </div>
                            ))}
                        </div>

                        <div className="sidebar-tagline">
                            <p>© 2026 Klassin.co.in</p>
                        </div>
                    </div>

                    {/* Right Side: Dynamic Form Area */}
                    <div className="login-form-area">
                        <div className="form-wrapper-box">
                            {selectedRole === 'institute' && <InstituteLogin onBack={() => {}} onClose={onClose} isSplitView={true} />}
                            {selectedRole === 'teacher' && <TeacherLogin onBack={() => {}} onClose={onClose} isSplitView={true} />}
                            {selectedRole === 'student' && <StudentLogin onBack={() => {}} onClose={onClose} isSplitView={true} />}
                            {selectedRole === 'admin' && <AdminLogin onBack={() => {}} onClose={onClose} isSplitView={true} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginDialog;
