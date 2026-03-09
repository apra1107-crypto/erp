import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './AuthForms.css';

const AdminLogin = ({ onBack, onClose, isSplitView }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!formData.email || !formData.password) {
            toast.error('Please enter email and password');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(`${API_ENDPOINTS.AUTH.ADMIN}/login`, {
                email: formData.email,
                password: formData.password,
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('userData', JSON.stringify(response.data.admin));
            localStorage.setItem('userType', 'admin');

            toast.success('Admin login successful!');

            setTimeout(() => {
                onClose();
                navigate('/admin-dashboard');
            }, 800);
        } catch (error) {
            console.error('Login error details:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Invalid credentials';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-step-container">
            {isSplitView && (
                <div className="split-view-header">
                    <div className="auth-view-icon orange">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <h2 className="auth-view-title">Admin Portal</h2>
                    <p className="auth-view-subtitle">System administration</p>
                </div>
            )}
            {!isSplitView && (
                <>
                    <button className="step-back-btn" onClick={onBack}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to roles
                    </button>
                    <div className="auth-view-header">
                        <div className="auth-view-icon orange">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <h2 className="auth-view-title">Admin Portal</h2>
                        <p className="auth-view-subtitle">System administrator access</p>
                    </div>
                </>
            )}

            <form className="auth-view-form" onSubmit={handleLogin}>
                <div className="auth-input-group">
                    <label>Email Address</label>
                    <div className="auth-input-wrapper">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <input
                            type="email"
                            name="email"
                            placeholder="username@domain.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                <div className="auth-input-group">
                    <label>Password</label>
                    <div className="auth-input-wrapper">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        <input
                            type="password"
                            name="password"
                            placeholder="Enter Password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                    {loading ? <div className="auth-loader"></div> : 'Sign In Now'}
                </button>
            </form>

            {!isSplitView && (
                <div className="auth-view-footer">
                    <p>Restricted access for system administrators only</p>
                </div>
            )}
        </div>
    );
};

export default AdminLogin;
