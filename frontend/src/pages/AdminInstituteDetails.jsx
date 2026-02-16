import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import socket, { joinAdminRoom } from '../socket';
import AdminSubscriptionManager from '../components/AdminSubscriptionManager';
import './AdminInstituteDetails.css';

const AdminInstituteDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [institute, setInstitute] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInstituteDetails();
        joinAdminRoom();

        socket.on('payment_received', (data) => {
            if (parseInt(data.instituteId) === parseInt(id)) {
                fetchInstituteDetails();
            }
        });

        return () => {
            socket.off('payment_received');
        };
    }, [id]);

    const fetchInstituteDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ADMIN_DASHBOARD}/institute/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstitute(response.data);
        } catch (error) {
            console.error('Error fetching details:', error);
            setError(error.response?.data?.message || 'Failed to load institute details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="admin-loading">Loading Details...</div>;
    if (error) return <div className="admin-error-message">{error}</div>;
    if (!institute) return null;

    return (
        <div className="admin-details-page">
            <button className="back-btn" onClick={() => navigate('/admin-dashboard')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to Dashboard
            </button>

            <div className="details-header">
                <div className="dh-left">
                    <div className="dh-logo">
                        {institute.logo_url ? <img src={institute.logo_url} alt="Logo" /> : (institute.institute_name || '?').charAt(0)}
                    </div>
                    <div>
                        <h1 className="dh-title">{institute.institute_name}</h1>
                        <p className="dh-meta">ID: {institute.id} • Joined {new Date(institute.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className={`dh-status ${institute.current_status?.toLowerCase() || 'inactive'}`}>
                    {institute.current_status === 'Active' ? `Expires: ${institute.subscription_end_date ? new Date(institute.subscription_end_date).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                    }) : 'N/A'}` :
                        institute.current_status}
                </div>
            </div>

            <div className="details-grid">
                {/* Stats Cards */}
                <div className="d-card stats-section">
                    <h3>Overview</h3>
                    <div className="stats-row">
                        <div className="d-stat">
                            <span className="val">{institute.stats.students}</span>
                            <span className="lbl">Students</span>
                        </div>
                        <div className="d-stat">
                            <span className="val">{institute.stats.teachers}</span>
                            <span className="lbl">Teachers</span>
                        </div>
                    </div>
                </div>

                {/* Principal Info */}
                <div className="d-card">
                    <h3>Principal Details</h3>
                    <div className="profile-row">
                        <img
                            src={institute.principal_photo_url || 'https://via.placeholder.com/60'}
                            alt="Principal"
                            className="principal-thumb"
                        />
                        <div>
                            <h4>{institute.principal_name}</h4>
                            <p className="text-secondary">{institute.email}</p>
                            <p className="text-secondary">{institute.mobile}</p>
                        </div>
                    </div>
                </div>

                {/* Address Info */}
                <div className="d-card">
                    <h3>Location</h3>
                    <div className="address-text">
                        <p>{institute.address}</p>
                        <p>{institute.city || institute.district}, {institute.state}</p>
                        <p>{institute.pincode}</p>
                    </div>
                </div>

                {/* Subscription Manager - Full Width */}
                <div className="d-card full-width">
                    <AdminSubscriptionManager
                        instituteId={institute.id}
                        currentStatus={institute.current_status}
                        onUpdate={fetchInstituteDetails}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminInstituteDetails;
