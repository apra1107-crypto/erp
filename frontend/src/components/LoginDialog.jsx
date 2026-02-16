import React, { useState } from 'react';
import './LoginDialog.css';
import InstituteLogin from './InstituteLogin';
import StudentLogin from './StudentLogin';
import TeacherLogin from './TeacherLogin';
import AdminLogin from './AdminLogin';

const LoginDialog = ({ isOpen, onClose }) => {
    const [selectedRole, setSelectedRole] = useState(null);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target.className === 'login-overlay') {
            handleClose();
        }
    };

    const handleBack = () => {
        setSelectedRole(null);
    };

    const handleClose = () => {
        onClose();
        setTimeout(() => setSelectedRole(null), 300);
    };

    return (
        <div className="login-overlay" onClick={handleBackdropClick}>
            <div className="login-modal">
                <button className="modal-close" onClick={handleClose}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {!selectedRole ? (
                    <div className="role-selection-view">
                        <div className="view-header">
                            <h2 className="view-title">Welcome Back</h2>
                            <p className="view-subtitle">Please select your portal to continue</p>
                        </div>

                        <div className="role-options">
                            <div className="role-option-card" onClick={() => setSelectedRole('institute')}>
                                <div className="role-icon-box blue">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" />
                                    </svg>
                                </div>
                                <div className="role-info">
                                    <h3>Institute Login</h3>
                                    <p>Principals & Administrators</p>
                                </div>
                                <svg className="arrow-right" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </div>

                            <div className="role-option-card" onClick={() => setSelectedRole('teacher')}>
                                <div className="role-icon-box purple">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-3-3.87M4 19v-2a4 4 0 0 1 4-4h1M16 11a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
                                    </svg>
                                </div>
                                <div className="role-info">
                                    <h3>Teacher Login</h3>
                                    <p>Faculty & Staff Members</p>
                                </div>
                                <svg className="arrow-right" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </div>

                            <div className="role-option-card" onClick={() => setSelectedRole('student')}>
                                <div className="role-icon-box pink">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="7" r="4" />
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    </svg>
                                </div>
                                <div className="role-info">
                                    <h3>Student Login</h3>
                                    <p>Learner & Parent Access</p>
                                </div>
                                <svg className="arrow-right" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </div>

                            <div className="role-option-card" onClick={() => setSelectedRole('admin')}>
                                <div className="role-icon-box orange">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                                    </svg>
                                </div>
                                <div className="role-info">
                                    <h3>Admin Login</h3>
                                    <p>System Administrator</p>
                                </div>
                                <svg className="arrow-right" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </div>
                        </div>

                        <div className="view-footer">
                            <p>Trouble logging in? <a href="#">Contact Support</a></p>
                        </div>
                    </div>
                ) : (
                    <div className="login-form-view">
                        {selectedRole === 'institute' && <InstituteLogin onBack={handleBack} onClose={handleClose} />}
                        {selectedRole === 'teacher' && <TeacherLogin onBack={handleBack} onClose={handleClose} />}
                        {selectedRole === 'student' && <StudentLogin onBack={handleBack} onClose={handleClose} />}
                        {selectedRole === 'admin' && <AdminLogin onBack={handleBack} onClose={handleClose} />}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginDialog;
