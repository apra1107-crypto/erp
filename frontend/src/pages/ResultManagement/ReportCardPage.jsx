import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BASE_URL } from '../../config';
import ReportCardView from './ReportCardView';

const ReportCardPage = () => {
    const { examId, studentId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Hide dashboard UI on mount
        document.body.classList.add('hide-dashboard-ui');
        
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`${BASE_URL}/api/exam/${examId}/marksheet/${studentId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(response.data);
            } catch (error) {
                console.error("Error fetching report card data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Restore dashboard UI on unmount
        return () => {
            document.body.classList.remove('hide-dashboard-ui');
        };
    }, [examId, studentId]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Generating Report Card PDF View...</div>;
    if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>Error loading data.</div>;

    return (
        <div className="report-card-page-wrapper">
            {/* Back Button */}
            <div className="no-print" style={{ position: 'fixed', top: '30px', left: '30px', zIndex: 1000 }}>
                <button
                    onClick={() => window.history.back()}
                    className="report-card-back-btn"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    <span>Back to List</span>
                </button>
            </div>

            <ReportCardView
                student={data.student}
                exam={data.exam}
                institute={data.institute}
                result={data.result}
            />

            <style>{`
                /* Fullscreen Override when hide-dashboard-ui is active */
                body.hide-dashboard-ui .dashboard-header-modern,
                body.hide-dashboard-ui .dashboard-sidebar {
                    display: none !important;
                }

                body.hide-dashboard-ui .dashboard-main-container {
                    margin-left: 0 !important;
                    padding-left: 0 !important;
                    margin-top: 0 !important;
                    width: 100% !important;
                }

                .report-card-back-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 20px;
                    background: #1e3a8a;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: 700;
                    font-size: 15px;
                    box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.3);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: 'Crimson Text', serif;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .report-card-back-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 25px -5px rgba(30, 58, 138, 0.4);
                    background: #1e40af;
                }

                .report-card-back-btn:active {
                    transform: translateY(0);
                }

                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .dashboard-sidebar, .dashboard-header-modern { display: none !important; }
                    .dashboard-main-container { margin-left: 0 !important; padding: 0 !important; width: 100% !important; }
                    .report-card-page-wrapper { margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </div>
    );
};

export default ReportCardPage;