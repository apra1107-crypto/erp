import React from 'react';
import './Features.css';

const features = [
    {
        title: 'Personalized App',
        description: 'Custom-tailored experience for students, teachers, and administrators with role-specific dashboards.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
        )
    },
    {
        title: 'Live Attendance Update',
        description: 'Instant attendance tracking with real-time push notifications to parents and staff.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        )
    },
    {
        title: 'Marksheet Generate',
        description: 'Automated digital report cards and academic performance tracking at your fingertips.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
        )
    },
    {
        title: 'Notice Board',
        description: 'Centralized digital communication for events, holidays, and important announcements.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
        )
    },
    {
        title: 'Live Transport Tracking',
        description: 'Real-time school bus monitoring ensures student safety and route efficiency.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect>
                <path d="M7 21h0"></path>
                <path d="M17 21h0"></path>
                <path d="M4 18h16"></path>
            </svg>
        )
    },
    {
        title: 'Geo-fenced Attendance',
        description: 'Location-based check-in ensures teachers mark attendance only within school premises.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        )
    },
    {
        title: 'Efficient Fee Management',
        description: 'Secure, optimized fee collection with automated digital receipts and payment tracking.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
            </svg>
        )
    },
    {
        title: 'Push Notifications',
        description: 'Instant banner alerts across mobile and web platforms for all school updates.',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
        )
    }
];

const Features = () => {
    return (
        <section className="features-section" id="features">
            <div className="container">
                <div className="features-header">
                    <h2 
                        className="features-section-title"
                        style={{ 
                            fontSize: '3.5rem', 
                            fontWeight: '800', 
                            color: '#FFFFFF', 
                            textAlign: 'center',
                            marginBottom: '24px',
                            lineHeight: '1.2'
                        }}
                    >
                        Everything you need to run your institute professionally<span style={{ marginLeft: '4px', display: 'inline-block', width: '10px', height: '10px', backgroundColor: '#FFFFFF', borderRadius: '50%', verticalAlign: 'baseline' }}></span>
                    </h2>
                    <p 
                        className="features-section-subtitle"
                        style={{
                            fontSize: '1.2rem',
                            color: '#94A3B8',
                            textAlign: 'center',
                            maxWidth: '800px',
                            margin: '0 auto 80px',
                            lineHeight: '1.6'
                        }}
                    >
                        Experience the most comprehensive education management suite designed for modern institutions.
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div key={index} className="feature-card">
                            <div className="feature-icon-wrapper">
                                {feature.icon}
                            </div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;