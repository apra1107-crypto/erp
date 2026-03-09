import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import { toast } from 'react-toastify';
import './HomeworkHub.css';

const HomeworkHub = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [sectionsMap, setSectionsMap] = useState({});

    useEffect(() => {
        fetchAllClasses();
    }, []);

    const fetchAllClasses = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const storedSessionId = localStorage.getItem('selectedSessionId');
            
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': storedSessionId
                }
            });
            
            if (response.data && Array.isArray(response.data.students)) {
                const students = response.data.students;
                const classMap = {};
                
                students.forEach((s) => {
                    if (!classMap[s.class]) {
                        classMap[s.class] = new Set();
                    }
                    classMap[s.class].add(s.section);
                });

                const sortedClasses = Object.keys(classMap).sort((a, b) => {
                    const numA = parseInt(a);
                    const numB = parseInt(b);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return a.localeCompare(b);
                });

                const finalSectionsMap = {};
                sortedClasses.forEach(cls => {
                    finalSectionsMap[cls] = Array.from(classMap[cls]).sort();
                });

                setClasses(sortedClasses);
                setSectionsMap(finalSectionsMap);
            }
        } catch (error) {
            console.error('Error fetching all classes for homework:', error);
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="homework-loading">Loading Homework Hub...</div>;

    return (
        <div className="homework-hub-container">
            <header className="hub-header">
                <div className="hub-header-top">
                    <button className="hub-back-btn" onClick={() => navigate('/dashboard')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                    </button>
                    <h1>Homework</h1>
                </div>
                <p>Select a class and section to manage assignments</p>
            </header>

            <div className="class-grid-hub">
                {classes.length > 0 ? (
                    classes.map((cls) => (
                        <div key={cls} className="hub-class-card">
                            <div className="hub-card-header">
                                <div className="hub-class-badge">{cls}</div>
                                <h3>Class {cls}</h3>
                            </div>
                            <div className="hub-sections-row">
                                {sectionsMap[cls]?.map((sec) => (
                                    <button
                                        key={sec}
                                        className="hub-section-btn"
                                        onClick={() => navigate(`/dashboard/homework/${cls}/${sec}`)}
                                    >
                                        Section {sec}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="hub-empty-state">
                        <div className="empty-icon">🏫</div>
                        <h3>No Classes Found</h3>
                        <p>Assign students to classes to see them here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeworkHub;
