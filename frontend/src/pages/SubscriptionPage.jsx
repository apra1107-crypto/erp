import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import socket, { joinInstituteRoom } from '../socket';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
    const navigate = useNavigate();
    const [months, setMonths] = useState(1);
    const [planPrice, setPlanPrice] = useState(499);
    const [loading, setLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchSubscriptionData();

        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const instId = userData.id || localStorage.getItem('instituteId');
        if (instId) {
            joinInstituteRoom(instId);
        }

        socket.on('subscription_update', (data) => {
            console.log('Socket Update on Sub Page:', data);
            if (data.settings) {
                setPlanPrice(parseFloat(data.settings.monthly_price));
                setSubscriptionStatus(prev => ({ ...prev, ...data.settings, status: data.status }));
            }
        });

        return () => {
            socket.off('subscription_update');
        };
    }, []);

    const fetchSubscriptionData = async () => {
        try {
            const token = localStorage.getItem('token');
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const instituteId = userData.id || localStorage.getItem('instituteId');

            console.log('Fetching subscription for Institute:', instituteId);

            if (!instituteId) {
                console.warn('No instituteId found in storage');
                return;
            }

            // Fetch subscription settings
            const settingsRes = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Settings received:', settingsRes.data);

            if (settingsRes.data) {
                const price = parseFloat(settingsRes.data.monthly_price);
                if (!isNaN(price)) {
                    setPlanPrice(price);
                    console.log('Plan price updated to:', price);
                }
            }

            // Fetch subscription status
            const statusRes = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Status received:', statusRes.data);
            setSubscriptionStatus(statusRes.data);

            // If status response has monthly_price, use it
            if (statusRes.data && statusRes.data.monthly_price) {
                const price = parseFloat(statusRes.data.monthly_price);
                if (!isNaN(price)) {
                    setPlanPrice(price);
                    console.log('Price synced from status:', price);
                }
            }

            // Fetch actual history logs
            const logsRes = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Filter only PAYMENT types for the history list, or show all actions
            const paymentLogs = (logsRes.data || []).filter(log => log.action_type === 'PAYMENT');
            setHistory(paymentLogs);

        } catch (error) {
            console.error('Failed to load billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleIncrement = () => setMonths(prev => prev + 1);
    const handleDecrement = () => setMonths(prev => Math.max(1, prev - 1));

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async () => {
        try {
            const res = await loadRazorpayScript();

            if (!res) {
                alert("Razorpay SDK failed to load. Are you online?");
                return;
            }

            const token = localStorage.getItem('token');
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            const instituteId = userData.id || localStorage.getItem('instituteId');

            // 1. Create Order on Backend
            const orderResponse = await axios.post(
                `${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/razorpay/order`,
                {
                    months: months,
                    amount: months * planPrice
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (!orderResponse.data.success) {
                alert("Failed to create Razorpay order");
                return;
            }

            const { order, key_id } = orderResponse.data;

            // 2. Open Razorpay Checkout
            const options = {
                key: key_id,
                amount: order.amount,
                currency: order.currency,
                name: "Klassin ERP",
                description: `Subscription Renewal for ${months} months`,
                order_id: order.id,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment on Backend
                        const verifyRes = await axios.post(
                            `${API_ENDPOINTS.SUBSCRIPTION}/${instituteId}/razorpay/verify`,
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                instituteId,
                                months,
                                amount: order.amount
                            },
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );

                        if (verifyRes.data.success) {
                            alert("Payment Successful! Subscription renewed.");
                            navigate('/dashboard');
                        } else {
                            alert("Payment verification failed. Please contact support.");
                        }
                    } catch (err) {
                        console.error("Verification Error:", err);
                        alert("Error verifying payment.");
                    }
                },
                prefill: {
                    name: userData.principal_name,
                    email: userData.email,
                    contact: userData.mobile,
                },
                theme: {
                    color: "#111827",
                },
            };

            const rzp1 = new window.Razorpay(options);
            rzp1.open();

        } catch (error) {
            console.error('Error initiating payment:', error);
            alert('Error initiating payment. Please try again.');
        }
    };



    if (loading) {
        return (
            <div className="sub-bento-wrapper">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="sub-bento-wrapper">
            <h1 className="sub-page-title">Subscription & Billing</h1>

            {/* Floating Back Button */}
            <button className="floating-back-btn" onClick={() => navigate(-1)} title="Back">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>

            {/* Main Bento Grid */}
            <div className="bento-grid">

                {/* 1. Plan Visual Card */}
                <div className="bento-item area-plan">
                    <div className="glass-overlay"></div>
                    <div className="plan-content">
                        <div className="plan-top">
                            <span className="plan-label">Current Plan</span>
                            <span className={`plan-status-badge ${subscriptionStatus?.status}`}>
                                {subscriptionStatus?.status === 'active' ? 'Active' :
                                    subscriptionStatus?.status === 'grant' ? 'Special Access' :
                                        subscriptionStatus?.status === 'disabled' ? 'Disabled' : 'Expired'}
                            </span>
                        </div>
                        <h2 className="plan-title">Premium<br />Institute</h2>
                        <div className="plan-price-row">
                            <span className="currency">₹</span>
                            <span className="amount">{parseFloat(planPrice || 499).toLocaleString('en-IN')}</span>
                            <span className="period">/mo</span>
                        </div>
                        <div className="plan-features-list">
                            <span>Unlimited Students</span>
                            <span>Full Analytics</span>
                            {subscriptionStatus?.status === 'active' && (
                                <span className="expiry-date-detail" style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '4px' }}>
                                    Expires: {new Date(subscriptionStatus.subscription_end_date).toLocaleString('en-IN', {
                                        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                                    })}
                                </span>
                            )}
                            {subscriptionStatus?.status === 'grant' && (
                                <span className="expiry-date-detail" style={{ fontSize: '0.8rem', color: '#8b5cf6', marginTop: '4px', fontWeight: '500' }}>
                                    ⚡ Identity Verified & Access Granted by Admin
                                </span>
                            )}
                        </div>
                    </div>
                </div>



                {/* 3. Action / Renewal Center (Centerpiece) */}
                <div className="bento-item area-action">
                    <div className="action-header">
                        <h3>Extend Subscription</h3>
                        <p>Select duration to add</p>
                    </div>

                    <div className="interactive-counter">
                        <button className="counter-btn" onClick={handleDecrement} disabled={months <= 1}>−</button>
                        <div className="counter-display">
                            <span className="count">{months}</span>
                            <span className="label text-xs uppercase tracking-wider text-gray-400">Month{months > 1 ? 's' : ''}</span>
                        </div>
                        <button className="counter-btn" onClick={handleIncrement}>+</button>
                    </div>

                    <div className="bill-preview">
                        <div className="bill-row">
                            <span>Subtotal</span>
                            <span>₹{months * planPrice}</span>
                        </div>
                        <div className="bill-divider"></div>
                        <div className="bill-row total">
                            <span>Total</span>
                            <span>₹{months * planPrice}</span>
                        </div>
                    </div>

                    <button className="action-pay-btn" onClick={handlePayment}>
                        Proceed to Pay
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </button>
                </div>

                {/* 4. History List */}
                <div className="bento-item area-history">
                    <div className="history-head">
                        <h3>History</h3>
                        <span className="history-badge">{history.length}</span>
                    </div>
                    <div className="history-scroll-area">
                        {history.length === 0 ? (
                            <div className="no-history">No payment records found.</div>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="history-row-item">
                                    <div className="row-icon-status">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                    <div className="row-info">
                                        <span className="row-date">{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <span className="row-id">TXN-{item.id}</span>
                                    </div>
                                    <span className="row-amount">₹{item.amount}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SubscriptionPage;
