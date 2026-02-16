import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatIndianDate, getRemainingTimeText } from '../utils/dateFormatter';
import { explainCode } from '../utils/codeHelper';

const DashboardOverview = ({ userData, profileData, subData }) => {
    const navigate = useNavigate();

    // Calculate subscription details
    let timeLeftText = 'Checking...';
    let expiryText = '';
    let label = 'Premium Access';
    let progressColor = '#10b981'; // Green default
    let percentage = 0;

    if (subData) {
        const today = new Date();
        const expiryDate = subData.status === 'active'
            ? new Date(subData.subscription_end_date)
            : today; // If not active/expired, treat as expired

        expiryText = formatIndianDate(subData.subscription_end_date);
        timeLeftText = getRemainingTimeText(subData.subscription_end_date);

        // FOR TESTING Visuals: Show progress based on "last 10 mins" window or just fixed 100% if active
        // Ideally this should be (expiry - start) / total_duration, but for now we visualize "risk"
        const diffMs = expiryDate - today;
        const diffMins = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

        if (subData.status === 'grant') {
            percentage = 100;
            progressColor = '#8b5cf6'; // Purple
            label = 'Special Admin Access';
            timeLeftText = 'Override Active';
            expiryText = 'Unlimited Access';
        } else if (subData.status !== 'active') {
            percentage = 0;
            progressColor = '#9ca3af'; // Grey
            label = 'Access Expired';
        } else {
            // Visual logic: active is full green unless low
            if (diffMins < 2) {
                progressColor = '#ef4444'; // Red
                percentage = 15;
            } else if (diffMins < 10) {
                progressColor = '#f59e0b'; // Orange
                percentage = 40;
            } else {
                percentage = 100;
            }
        }
    }

    return (
        <div className="overview-container">
            {/* Subscription Line Indicator - Dashboard Only */}
            <div
                className="subscription-indicator-compact"
                onClick={() => navigate('/dashboard/subscription')}
                title={`Full Details: ${label} | Expires on ${expiryText}`}
            >
                <div className="sub-header-minimal">
                    <span className="sub-duration-badge" style={{ color: progressColor }}>
                        {timeLeftText}
                    </span>
                </div>
                <div className="sub-progress-narrow">
                    <div
                        className="sub-fill-narrow"
                        style={{
                            width: `${percentage}%`,
                            backgroundColor: progressColor,
                            boxShadow: `0 0 10px ${progressColor}40`
                        }}
                    ></div>
                </div>
            </div>

            <div className="detailed-info-grid">
                <div className="info-card-modern">
                    <div className="info-card-header">
                        <div className="header-icon-box">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7l9-4 9 4M5 21V10M19 21V10M9 21v-6h6v6" /></svg>
                        </div>
                        <h3>Institute Identity</h3>
                    </div>
                    <div className="data-points">
                        <div className="data-row">
                            <span className="dot blue"></span>
                            <label>Official Name</label>
                            <p>{userData?.institute_name}</p>
                        </div>
                        <div className="data-row">
                            <span className="dot purple"></span>
                            <label>Portal Code</label>
                            <p className="code-text" title={explainCode(userData?.unique_code)}>{userData?.unique_code}</p>
                        </div>
                        <div className="data-row">
                            <span className="dot green"></span>
                            <label>System Email</label>
                            <p>{userData?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="info-card-modern">
                    <div className="info-card-header">
                        <div className="header-icon-box orange">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        </div>
                        <h3>Presence & Location</h3>
                    </div>
                    <div className="data-points">
                        <div className="data-row">
                            <span className="dot orange"></span>
                            <label>Mobile Line</label>
                            <p>{userData?.mobile}</p>
                        </div>
                        <div className="data-row">
                            <span className="dot cyan"></span>
                            <label>State & Dist</label>
                            <p>{userData?.state}, {userData?.district}</p>
                        </div>
                        <div className="data-row">
                            <span className="dot pink"></span>
                            <label>Full Address</label>
                            <p className="address-text">{userData?.address || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
