import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';

const Hero = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');

        if (token && userType) {
            if (userType === 'admin') {
                navigate('/admin-dashboard', { replace: true });
            } else if (userType === 'principal') {
                navigate('/dashboard', { replace: true });
            } else if (userType === 'student') {
                navigate('/student-dashboard', { replace: true });
            } else if (userType === 'teacher') {
                navigate('/teacher-dashboard', { replace: true });
            }
        }
    }, [navigate]);

    return (
        <section className="hero-section" id="home">
            <div className="container">
                <div className="hero-grid">
                    {/* Left Content */}
                    <div className="hero-content-left">
                        <div className="hero-eyebrow">
                            <span className="eyebrow-dot"></span>
                            <span>The New Standard in Education</span>
                        </div>

                        <h1 className="hero-headline">
                            Manage your institute <br />
                            with <span className="headline-gradient">intelligent tools.</span>
                        </h1>

                        <p className="hero-description">
                            A unified platform that streamlines administration, enhances learning,
                            and empowers educators to focus on what matters most.
                        </p>

                        <div className="hero-cta-group">
                            <button className="btn-primary">Start Free Trial</button>
                            <button className="btn-secondary">View Demo</button>
                        </div>
                    </div>

                    {/* Right Visual - Abstract Dashboard Mockup */}
                    <div className="hero-visual-right">
                        <div className="dashboard-mockup">
                            <div className="mockup-header">
                                <div className="mockup-dot-group">
                                    <div className="mock-dot"></div>
                                    <div className="mock-dot"></div>
                                    <div className="mock-dot"></div>
                                </div>
                                <div className="mock-search"></div>
                            </div>
                            <div className="mockup-body">
                                <div className="mock-sidebar">
                                    <div className="mock-line"></div>
                                    <div className="mock-line"></div>
                                    <div className="mock-line long"></div>
                                    <div className="mock-line"></div>
                                </div>
                                <div className="mock-content">
                                    <div className="mock-graph"></div>
                                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                        <div className="mock-line full"></div>
                                        <div className="mock-line full"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Analytics Card */}
                            <div className="floating-card">
                                <div className="floating-icon">
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="mock-line" style={{ width: '60px', marginBottom: '4px' }}></div>
                                    <div className="mock-line" style={{ width: '90px', opacity: 0.5 }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;