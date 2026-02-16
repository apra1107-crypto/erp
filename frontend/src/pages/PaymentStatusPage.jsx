import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import './SubscriptionPage.css'; // Reuse CSS

const PaymentStatusPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('VERIFYING'); // VERIFYING, SUCCESS, FAILED
    const transactionId = searchParams.get('id');
    const instituteId = searchParams.get('instId');
    const months = searchParams.get('months');

    useEffect(() => {
        if (transactionId) {
            verifyPayment();
        } else {
            setStatus('FAILED');
        }
    }, []);

    const verifyPayment = async () => {
        try {
            const token = localStorage.getItem('token');
            // Call backend status check
            // Pass instituteId and months as query params so backend can fulfill if valid
            const response = await axios.get(
                `${API_ENDPOINTS.SUBSCRIPTION}/status/${transactionId}?instituteId=${instituteId}&months=${months}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (response.data.success) {
                setStatus('SUCCESS');
                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            } else {
                setStatus('FAILED');
            }
        } catch (error) {
            console.error("Verification Error:", error);
            setStatus('FAILED');
        }
    };

    return (
        <div className="sub-bento-wrapper" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="payment-status-card" style={{ textAlign: 'center', background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
                {status === 'VERIFYING' && (
                    <>
                        <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
                        <h2>Verifying Payment...</h2>
                        <p>Please do not close this window.</p>
                    </>
                )}

                {status === 'SUCCESS' && (
                    <>
                        <div style={{ color: '#10b981', marginBottom: '16px' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        </div>
                        <h2>Payment Successful!</h2>
                        <p>Your subscription has been extended.</p>
                        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '10px' }}>Redirecting to dashboard...</p>
                    </>
                )}

                {status === 'FAILED' && (
                    <>
                        <div style={{ color: '#ef4444', marginBottom: '16px' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        </div>
                        <h2>Payment Failed</h2>
                        <p>We couldn't verify the transaction.</p>
                        <button
                            onClick={() => navigate('/dashboard/subscription')}
                            style={{
                                marginTop: '20px',
                                padding: '10px 20px',
                                background: '#111827',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentStatusPage;
