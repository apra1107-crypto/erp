import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Attendance.css';

const Attendance = () => {
    const navigate = useNavigate();
    const rawData = localStorage.getItem('userData');
    const userData = rawData ? JSON.parse(rawData) : null;
    const userType = localStorage.getItem('userType');

    if (!userData) return <div className="attendance-loading"><p>Resolving profile...</p></div>;

    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState({});
    const [studentCounts, setStudentCounts] = useState({});

    const dashboardPath = userType === 'teacher' ? '/teacher-dashboard' : '/dashboard';

    useEffect(() => {
        fetchClassSections();
    }, []);

    const fetchClassSections = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const students = response.data.students || [];
            const classSet = new Set();
            const sectionMap = {};

            students.forEach(s => {
                const cls = String(s.class || '').trim();
                const sec = String(s.section || '').trim();

                if (cls && sec) {
                    classSet.add(cls);
                    if (!sectionMap[cls]) {
                        sectionMap[cls] = new Set();
                    }
                    sectionMap[cls].add(sec);
                }
            });

            const sortedClasses = Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const sectionObj = {};
            const countObj = {};

            sortedClasses.forEach(cls => {
                sectionObj[cls] = Array.from(sectionMap[cls]).sort();
                countObj[cls] = {};
                sectionObj[cls].forEach(sec => {
                    countObj[cls][sec] = students.filter(s => String(s.class).trim() === cls && String(s.section).trim() === sec).length;
                });
            });

            setClasses(sortedClasses);
            setSections(sectionObj);
            setStudentCounts(countObj);
        } catch (error) {
            console.error('Attendance Fetch Error:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                token: localStorage.getItem('token')?.substring(0, 10) + '...'
            });
            toast.error(`Failed to load classes: ${error.response?.data?.message || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="attendance-loading">
                <div className="spinner"></div>
                <p>Loading classes...</p>
            </div>
        );
    }

    return (
        <>
            <div className="header-toolbar">
                <h1>Select Class & Section</h1>
            </div>

            {classes.length === 0 ? (
                <div className="empty-state-card">
                    <div className="empty-icon-vibe">📅</div>
                    <h3>No academic sessions found</h3>
                    <p>Configure student profiles to begin tracking attendance.</p>
                </div>
            ) : (
                <div className="class-grid">
                    {classes.map((cls, index) => (
                        <div key={cls} className={`class-card color-${index % 6}`}>
                            <div className="class-header">
                                <div className="class-icon">
                                    <span>{cls}</span>
                                </div>
                                <h2>Class {cls}</h2>
                            </div>
                            <div className="sections-list">
                                {sections[cls]?.map(sec => (
                                    <div
                                        key={sec}
                                        className="section-item"
                                        onClick={() => navigate(`${dashboardPath}/attendance/${cls}/${sec}`)}
                                    >
                                        <span className="sec-name">Section {sec}</span>
                                        <span className="sec-count">{studentCounts[cls]?.[sec] || 0} students</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default Attendance;
