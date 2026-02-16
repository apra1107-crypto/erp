import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import '../components/AuthForms.css';
import './InstituteRegister.css';

const InstituteRegister = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        institute_name: '',
        principal_name: '',
        email: '',
        mobile: '',
        state: '',
        district: '',
        pincode: '',
        landmark: '',
        address: '',
        password: '',
        confirm_password: '',
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!formData.institute_name || !formData.principal_name || !formData.email ||
            !formData.mobile || !formData.password || !formData.confirm_password) {
            toast.error('Please fill all required fields');
            return;
        }

        if (formData.password !== formData.confirm_password) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            setLoading(true);
            await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/register`, formData);
            toast.success('Institute registered successfully!');
            setTimeout(() => navigate('/'), 1500);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-container">
                <div className="register-header">
                    <button className="back-to-home" onClick={() => navigate('/')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back to Home
                    </button>

                    <div className="register-title-section">
                        <div className="register-icon">
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
                                <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h1>Register Institute</h1>
                        <p>Create your educational hub today</p>
                    </div>
                </div>

                <form onSubmit={handleRegister} className="register-form">
                    <div className="form-section">
                        <h3 className="section-title">Basic Information</h3>
                        <div className="form-group">
                            <label htmlFor="institute_name">Institute Name *</label>
                            <div className="input-wrapper">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <input
                                    type="text"
                                    id="institute_name"
                                    name="institute_name"
                                    placeholder="Enter institute name"
                                    value={formData.institute_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="principal_name">Principal Name *</label>
                            <div className="input-wrapper">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <input
                                    type="text"
                                    id="principal_name"
                                    name="principal_name"
                                    placeholder="Enter principal name"
                                    value={formData.principal_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="email">Official Email *</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" />
                                        <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        placeholder="institute@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="mobile">Mobile Number *</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="tel"
                                        id="mobile"
                                        name="mobile"
                                        placeholder="Enter mobile number"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Location Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="state">State</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" />
                                        <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="text"
                                        id="state"
                                        name="state"
                                        placeholder="Enter state"
                                        value={formData.state}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="district">District</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="text"
                                        id="district"
                                        name="district"
                                        placeholder="Enter district"
                                        value={formData.district}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="pincode">Pincode</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" />
                                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="text"
                                        id="pincode"
                                        name="pincode"
                                        placeholder="Enter pincode"
                                        value={formData.pincode}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="landmark">Landmark</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="text"
                                        id="landmark"
                                        name="landmark"
                                        placeholder="Enter landmark"
                                        value={formData.landmark}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="address">Complete Address</label>
                            <div className="input-wrapper">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" />
                                </svg>
                                <textarea
                                    id="address"
                                    name="address"
                                    placeholder="Enter complete address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    rows="3"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title">Security</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="password">Password *</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        placeholder="Create password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirm_password">Confirm Password *</label>
                                <div className="input-wrapper">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" />
                                    </svg>
                                    <input
                                        type="password"
                                        id="confirm_password"
                                        name="confirm_password"
                                        placeholder="Confirm password"
                                        value={formData.confirm_password}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? (
                            <div className="spinner"></div>
                        ) : (
                            'Register Now'
                        )}
                    </button>

                    <div className="auth-footer">
                        <p>Already have an account?</p>
                        <button type="button" className="link-btn" onClick={() => navigate('/')}>
                            Sign In
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InstituteRegister;
