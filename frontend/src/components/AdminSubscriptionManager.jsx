import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import socket, { joinAdminRoom } from '../socket';
import './AdminSubscriptionManager.css';

const AdminSubscriptionManager = ({ instituteId, currentStatus, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [logs, setLogs] = useState([]);
    const [settings, setSettings] = useState({
        monthly_price: 499,
        subscription_end_date: null,
        override_access: false
    });

    useEffect(() => {
        fetchData();
        joinAdminRoom();

        socket.on('payment_received', (data) => {
            if (parseInt(data.instituteId) === parseInt(instituteId)) {
                fetchData(); // Refresh history and overview
            }
        });

        return () => {
            socket.off('payment_received');
        };
    }, [instituteId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // Parallel fetch
            const [settingsRes, logsRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/logs`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const s = settingsRes.data;
            setSettings({
                monthly_price: parseFloat(s.monthly_price) || 499,
                subscription_end_date: s.subscription_end_date,
                override_access: s.override_access || false
            });
            setLogs(logsRes.data || []);
        } catch (error) {
            console.error('Error fetching subscription data:', error);
            // Don't show toast error on initial load if it's just missing settings
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAll = async () => {
        try {
            setUpdating(true);
            const token = localStorage.getItem('token');
            await axios.put(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}`, settings, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('All changes saved successfully');
            fetchData(); // Refresh history and state
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save changes');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="sub-loading">Configuring secure access...</div>;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Not Set';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const getActionLabel = (type) => {
        switch (type) {
            case 'PRICE_CHANGE': return 'Price Update';
            case 'PAYMENT': return 'Payment Received';
            case 'ADMIN_OVERRIDE': return 'Admin Override';
            case 'INITIAL_SETUP': return 'Setup';
            default: return type.replace('_', ' ');
        }
    };

    const isPaidActive = settings.subscription_end_date && new Date(settings.subscription_end_date) > new Date();

    return (
        <div className="subscription-view-wrapper">
            <div className="subscription-cards-grid">

                {/* Card 1: Subscription Price */}
                <div className="sub-flashcard price-card">
                    <div className="sub-card-header">
                        <div className="sub-icon-box price">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                        </div>
                        <h4>Base Price</h4>
                    </div>
                    <div className="sub-card-body">
                        <p className="sub-desc">Monthly base cost for the institute.</p>
                        <div className="input-group-price">
                            <span className="curr">₹</span>
                            <input
                                type="number"
                                value={settings.monthly_price}
                                onChange={(e) => setSettings({ ...settings, monthly_price: e.target.value })}
                            />
                        </div>
                    </div>
                </div>





                {/* Card: Emergency Override (Super Power Button) */}
                <div className="sub-flashcard override-card" style={{ borderColor: settings.override_access ? '#8b5cf6' : '#e5e7eb' }}>
                    <div className="sub-card-header">
                        <div className="sub-icon-box purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                        </div>
                        <h4>Super Power Access</h4>
                    </div>
                    <div className="sub-card-body">
                        <p className="sub-desc" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>
                            {isPaidActive
                                ? "Override disabled. Institute has active paid plan."
                                : "Grant temporary access without payment logic."}
                        </p>
                        <button
                            className={`status-toggle-pill ${settings.override_access ? 'active-purple' : 'disabled'} ${isPaidActive ? 'locked-cursor' : ''}`}
                            onClick={() => !isPaidActive && setSettings({ ...settings, override_access: !settings.override_access })}
                            disabled={isPaidActive}
                            style={{ width: '100%', justifyContent: 'center', opacity: isPaidActive ? 0.6 : 1 }}
                        >
                            {settings.override_access ? '⚡ Access Granted' : 'Off'}
                        </button>
                    </div>
                </div>

                {/* Card 4: Current Status Overview */}
                <div className="sub-flashcard overview-card">
                    <div className="sub-card-header">
                        <div className="sub-icon-box overview">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        </div>
                        <h4>Billing Overview</h4>
                    </div>
                    <div className="sub-card-body stats-view">
                        <div className={`status-pill ${currentStatus?.toLowerCase()}`}>
                            {currentStatus}
                        </div>
                        <div className="mini-dates-list">
                            <div className="mini-date">
                                <span>Subscription Expiry:</span>
                                <span className="val highlight" style={{ fontSize: '0.85rem' }}>
                                    {settings.subscription_end_date ? new Date(settings.subscription_end_date).toLocaleString('en-IN', {
                                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                    }) : 'Not Set'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Save Button */}
            <div className="admin-actions-bar">
                <button className="save-all-btn" onClick={handleSaveAll} disabled={updating}>
                    {updating ? 'Applying Changes...' : 'Save All Settings'}
                </button>
            </div>

            {/* Card 5: Transaction History */}
            <div className="history-section-wrapper">
                <div className="history-card-full">
                    <div className="history-header">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                        <h3>Action & Transaction History</h3>
                    </div>
                    <div className="history-list">
                        {logs.length === 0 ? (
                            <p className="no-logs">No recent updates recorded.</p>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="log-item">
                                    <div className="log-marker"></div>
                                    <div className="log-main">
                                        <div className="log-top">
                                            <span className="log-type">{getActionLabel(log.action_type)}</span>
                                            <span className="log-time">{new Date(log.created_at).toLocaleString('en-IN', {
                                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', hour12: true
                                            })}</span>
                                        </div>
                                        <p className="log-details">{log.details}</p>
                                    </div>
                                    {log.amount && <span className="log-amt">₹{log.amount}</span>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSubscriptionManager;
