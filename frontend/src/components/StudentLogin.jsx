import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './AuthForms.css';

const StudentLogin = ({ onBack, onClose }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: phone, 2: institute, 3: student, 4: code
    const [mobile, setMobile] = useState('');
    const [institutes, setInstitutes] = useState([]);
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [accessCode, setAccessCode] = useState('');

    const handleVerifyPhone = async (e) => {
        e.preventDefault();

        if (!mobile || mobile.length < 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(`${API_ENDPOINTS.AUTH.STUDENT}/verify-phone`, {
                mobile
            });

            if (response.data.exists) {
                setInstitutes(response.data.institutes);
                setStep(2);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'No institutes found for this mobile number');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectInstitute = async (institute) => {
        try {
            setLoading(true);
            setSelectedInstitute(institute);

            const response = await axios.post(`${API_ENDPOINTS.AUTH.STUDENT}/get-students`, {
                mobile,
                institute_id: institute.id
            });

            setStudents(response.data.students);
            setStep(3);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        setStep(4);
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        // ALWAYS require access code for device-independent authentication
        if (!accessCode) {
            toast.error('Please enter your access code');
            return;
        }

        try {
            setLoading(true);

            // Always use verify-code endpoint - this ensures each device needs the code
            const response = await axios.post(`${API_ENDPOINTS.AUTH.STUDENT}/verify-code`, {
                student_id: selectedStudent.id,
                access_code: accessCode
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('userData', JSON.stringify(response.data.student));
            localStorage.setItem('userType', 'student');

            toast.success('Login successful!');
            setTimeout(() => {
                onClose();
                navigate('/student-dashboard');
            }, 1000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid access code');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 1) {
            onBack();
        } else if (step === 2) {
            setStep(1);
            setInstitutes([]);
        } else if (step === 3) {
            setStep(2);
            setStudents([]);
        } else if (step === 4) {
            setStep(3);
            setSelectedStudent(null);
            setAccessCode('');
        }
    };

    return (
        <div className="auth-step-container">
            <button className="step-back-btn" onClick={handleBack}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
            </button>

            <div className="auth-view-header">
                <div className="auth-view-icon blue">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </div>
                <h2 className="auth-view-title">Student Portal</h2>
                <p className="auth-view-subtitle">
                    {step === 1 && 'Enter your registered mobile number'}
                    {step === 2 && 'Select your institute'}
                    {step === 3 && 'Select your profile'}
                    {step === 4 && 'Enter your access code'}
                </p>
            </div>

            {step === 1 && (
                <form onSubmit={handleVerifyPhone} className="auth-view-form">
                    <div className="auth-input-group">
                        <label htmlFor="mobile">Mobile Number</label>
                        <div className="auth-input-wrapper">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="2" width="14" height="20" rx="2" />
                                <path d="M12 18h.01" />
                            </svg>
                            <input
                                type="tel"
                                id="mobile"
                                name="mobile"
                                placeholder="Enter 10-digit mobile number"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                maxLength="10"
                                pattern="[0-9]{10}"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? <div className="auth-loader"></div> : 'Continue'}
                    </button>
                </form>
            )}

            {step === 2 && (
                <div className="auth-view-form">
                    {institutes.map((institute) => (
                        <div
                            key={institute.id}
                            className="selection-card modern-card"
                            onClick={() => handleSelectInstitute(institute)}
                        >
                            <div className="selection-logo modern-logo">
                                {institute.logo_url ? (
                                    <img src={institute.logo_url} alt={institute.institute_name} />
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" />
                                    </svg>
                                )}
                            </div>
                            <div className="selection-info">
                                <h3>{institute.institute_name}</h3>
                                <p>{institute.address}</p>
                            </div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </div>
                    ))}
                </div>
            )}

            {step === 3 && (
                <div className="auth-view-form">
                    {students.map((student) => (
                        <div
                            key={student.id}
                            className="selection-card modern-card"
                            onClick={() => handleSelectStudent(student)}
                        >
                            <div className="selection-logo modern-logo">
                                {student.photo_url ? (
                                    <img src={student.photo_url} alt={student.name} className="round-photo" />
                                ) : (
                                    <div className="placeholder-avatar student-avatar">{student.name.charAt(0)}</div>
                                )}
                            </div>
                            <div className="selection-info">
                                <h3>{student.name}</h3>
                                <p>Class {student.class} - {student.section} | Roll No: {student.roll_no}</p>
                            </div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </div>
                    ))}
                </div>
            )}

            {step === 4 && (
                <form onSubmit={handleLogin} className="auth-view-form">
                    {selectedStudent && (
                        <div className="selected-profile modern-profile">
                            <div className="profile-photo">
                                {selectedStudent.photo_url ? (
                                    <img src={selectedStudent.photo_url} alt={selectedStudent.name} />
                                ) : (
                                    <div className="placeholder-avatar large student-avatar">{selectedStudent.name.charAt(0)}</div>
                                )}
                            </div>
                            <h3>{selectedStudent.name}</h3>
                            <p>Class {selectedStudent.class} - {selectedStudent.section}</p>
                        </div>
                    )}

                    <div className="access-code-container">
                        <input
                            type="text"
                            id="accessCode"
                            className="access-code-input"
                            placeholder="CODE"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            maxLength={6}
                            required
                            autoFocus
                        />
                        <div className="scanner-line"></div>
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? <div className="auth-loader"></div> : 'Login securely'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default StudentLogin;
