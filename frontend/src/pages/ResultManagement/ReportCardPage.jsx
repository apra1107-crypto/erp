import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReportCardView from './ReportCardView';

const ReportCardPage = () => {
    const { examId, studentId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get(`http://localhost:5000/api/exam/${examId}/marksheet/${studentId}`, {
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
    }, [examId, studentId]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Generating Report Card PDF View...</div>;
    if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>Error loading data.</div>;

    return (
        <div className="report-card-page-wrapper">
            {/* Minimal Back Button */}
            <div className="no-print" style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1000 }}>
                <button
                    onClick={() => window.history.back()}
                    style={{
                        padding: '10px 20px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <span>←</span> Back
                </button>
            </div>

            <ReportCardView
                student={data.student}
                exam={data.exam}
                institute={data.institute}
                result={data.result}
            />

            <style>{`
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
