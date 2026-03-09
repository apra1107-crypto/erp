import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './RouteManagement.css';

const RouteManagement = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const userType = localStorage.getItem('userType');
    const dashboardBase = userType === 'teacher' ? '/teacher-dashboard' : '/dashboard';

    const [bus, setBus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    
    // Local Session State (Initial values from DB, then managed locally)
    const [startPoint, setStartPoint] = useState('');
    const [endPoint, setEndPoint] = useState('');
    const [stops, setStops] = useState([]);
    const [assignments, setAssignments] = useState([]); 
    
    const [newStopName, setNewStopName] = useState('');
    const [allStudents, setStudentsList] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStopForAssign, setSelectedStopForAssign] = useState(null);

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            const busRes = await axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const selectedBus = busRes.data.buses.find(b => String(b.id) === String(id));
            
            if (selectedBus) {
                setBus(selectedBus);
                setStartPoint(selectedBus.start_point || '');
                setEndPoint(selectedBus.end_point || '');
                
                const stopsRes = await axios.get(`${API_ENDPOINTS.TRANSPORT}/stops/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedStops = stopsRes.data.stops || [];
                setStops(fetchedStops);
                if (fetchedStops.length > 0) setSelectedStopForAssign(fetchedStops[0].id);

                const assignRes = await axios.get(`${API_ENDPOINTS.TRANSPORT}/assignments/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAssignments(assignRes.data.assignments || []);

                const studentsRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStudentsList(studentsRes.data.students || []);
            } else {
                toast.error('Bus not found');
                navigate(`${dashboardBase}/transport`);
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStop = () => {
        if (!newStopName.trim()) return;
        const newStop = {
            id: `temp_${Date.now()}`, 
            stop_name: newStopName,
            order_index: stops.length
        };
        setStops([...stops, newStop]);
        setNewStopName('');
        if (!selectedStopForAssign) setSelectedStopForAssign(newStop.id);
    };

    const handleRemoveStop = (index) => {
        const stopToRemove = stops[index];
        setAssignments(assignments.filter(a => a.stop_id !== stopToRemove.id));
        const updatedStops = stops.filter((_, i) => i !== index)
            .map((stop, i) => ({ ...stop, order_index: i }));
        setStops(updatedStops);
        if (selectedStopForAssign === stopToRemove.id) {
            setSelectedStopForAssign(updatedStops[0]?.id || null);
        }
    };

    const handleLocalAssign = (student) => {
        if (!selectedStopForAssign) return toast.warning('Select a stop first');
        const existing = assignments.find(a => a.student_id === student.id);
        if (existing) {
            setAssignments(assignments.map(a => a.student_id === student.id ? { ...a, stop_id: selectedStopForAssign } : a));
        } else {
            setAssignments([...assignments, {
                student_id: student.id,
                stop_id: selectedStopForAssign,
                student_name: student.name,
                class: student.class,
                section: student.section,
                roll_no: student.roll_no,
                photo_url: student.photo_url
            }]);
        }
    };

    const handleLocalRemove = (studentId) => {
        setAssignments(assignments.filter(a => a.student_id !== studentId));
    };

    const handleFinalSave = async () => {
        if (!startPoint || !endPoint || stops.length === 0) {
            return toast.warning('Please complete route and stops before saving');
        }
        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.TRANSPORT}/sync-manifest/${id}`, {
                startPoint,
                endPoint,
                stops: stops.map((s, idx) => ({ stop_name: s.stop_name, order_index: idx })),
                assignments: assignments.map(a => {
                    const localStop = stops.find(s => s.id === a.stop_id);
                    return { student_id: a.student_id, stop_name: localStop.stop_name };
                })
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Transport manifest synchronized successfully');
            navigate(`${dashboardBase}/transport`);
        } catch (error) {
            console.error('Final save error:', error);
            toast.error('Failed to save manifest');
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = allStudents.filter(s => {
        const searchStr = (s.name + s.roll_no + s.class + s.section).toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
    });

    if (loading) return <div className="route-mgmt-loading">Loading route configuration...</div>;

    return (
        <div className="route-mgmt-page">
            <div className="route-mgmt-header">
                <button className="back-btn-minimal" onClick={() => navigate(`${dashboardBase}/transport`)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="header-text">
                    <h1 className="route-title">Manifest Configuration</h1>
                    <p className="bus-subtext">Bus: {bus?.bus_number} • {bus?.driver_name}</p>
                </div>
            </div>

            <div className="route-steps-indicator">
                <div className={`step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`} onClick={() => setCurrentStep(1)}>
                    <div className="step-circle">1</div>
                    <span>Route</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`} onClick={() => currentStep >= 2 && setCurrentStep(2)}>
                    <div className="step-circle">2</div>
                    <span>Stops</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step-item ${currentStep === 3 ? 'active' : ''}`} onClick={() => currentStep >= 3 && setCurrentStep(3)}>
                    <div className="step-circle">3</div>
                    <span>Students</span>
                </div>
            </div>

            <div className="route-config-container wide animate-in">
                {currentStep === 1 ? (
                    <div className="route-card-rectangular max-600">
                        <div className="route-card-header">
                            <h3>Journey Points</h3>
                        </div>
                        <div className="route-form-body">
                            <div className="input-group-premium">
                                <label>🏁 Starting Point</label>
                                <input type="text" value={startPoint} onChange={(e) => setStartPoint(e.target.value)} placeholder="Ex: School Campus" />
                            </div>
                            <div className="route-line-visual">
                                <div className="dot"></div><div className="line"></div><div className="dot"></div>
                            </div>
                            <div className="input-group-premium">
                                <label>📍 Ending Point</label>
                                <input type="text" value={endPoint} onChange={(e) => setEndPoint(e.target.value)} placeholder="Ex: City Center" />
                            </div>
                            <button className="next-step-btn" onClick={() => setCurrentStep(2)}>Next: Add Stops</button>
                        </div>
                    </div>
                ) : currentStep === 2 ? (
                    <div className="route-card-rectangular max-600">
                        <div className="route-card-header">
                            <h3>Bus Stops Manifest</h3>
                        </div>
                        <div className="route-form-body">
                            <div className="add-stop-input-group">
                                <input 
                                    type="text" 
                                    placeholder="Stop Name..." 
                                    value={newStopName}
                                    onChange={(e) => setNewStopName(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddStop()}
                                />
                                <button className="add-stop-btn-inner" onClick={handleAddStop}>Add</button>
                            </div>
                            <div className="stops-list-container">
                                <div className="stop-item-visual start"><div className="stop-marker start"></div><span className="stop-name">{startPoint} (Start)</span></div>
                                {stops.map((stop, index) => (
                                    <div key={stop.id} className="stop-item-visual middle">
                                        <div className="stop-marker middle"></div>
                                        <div className="stop-content">
                                            <span className="stop-name">{stop.stop_name}</span>
                                            <button className="remove-stop-btn" onClick={() => handleRemoveStop(index)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                                        </div>
                                    </div>
                                ))}
                                <div className="stop-item-visual end"><div className="stop-marker end"></div><span className="stop-name">{endPoint} (End)</span></div>
                            </div>
                            <div className="step-actions-row">
                                <button className="secondary-btn" onClick={() => setCurrentStep(1)}>Back</button>
                                <button className="next-step-btn" onClick={() => setCurrentStep(3)}>Next: Assign Students</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="assignment-layout">
                        <div className="stops-sidebar-rectangular">
                            <h3>Select Destination</h3>
                            <div className="sidebar-stops-list">
                                {stops.map((stop) => (
                                    <button 
                                        key={stop.id} 
                                        className={`sidebar-stop-btn ${selectedStopForAssign === stop.id ? 'active' : ''}`}
                                        onClick={() => setSelectedStopForAssign(stop.id)}
                                    >
                                        <div className="stop-dot"></div>
                                        <span>{stop.stop_name}</span>
                                        <span className="assigned-count">
                                            {assignments.filter(a => a.stop_id === stop.id).length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="student-selection-panel">
                            <div className="panel-header-row assignment-header">
                                <div className="search-box-premium">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                    <input 
                                        type="text" 
                                        placeholder="Search Students..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="final-actions">
                                    <button className="secondary-btn" onClick={() => setCurrentStep(2)}>Back</button>
                                    <button className="finish-assignment-btn" onClick={handleFinalSave} disabled={saving}>
                                        {saving ? 'Syncing...' : 'Save & Finish'}
                                    </button>
                                </div>
                            </div>

                            <div className="students-scroll-grid">
                                {filteredStudents.map(student => {
                                    const assignment = assignments.find(a => a.student_id === student.id);
                                    const isAssignedToCurrent = assignment?.stop_id === selectedStopForAssign;
                                    const isAssignedElsewhere = assignment && !isAssignedToCurrent;

                                    return (
                                        <div key={student.id} className={`student-assign-card ${isAssignedToCurrent ? 'assigned' : ''} ${isAssignedElsewhere ? 'elsewhere' : ''}`}>
                                            <div className="student-info-mini">
                                                <img src={student.photo_url || 'https://via.placeholder.com/40'} alt="" />
                                                <div className="s-meta">
                                                    <p className="s-name">{student.name}</p>
                                                    <p className="s-class">Class {student.class}-{student.section}</p>
                                                </div>
                                            </div>
                                            {isAssignedToCurrent ? (
                                                <button className="remove-assign-btn" onClick={() => handleLocalRemove(student.id)}>Remove</button>
                                            ) : (
                                                <button className="add-assign-btn" onClick={() => handleLocalAssign(student)}>
                                                    {isAssignedElsewhere ? 'Switch Stop' : 'Add to Stop'}
                                                </button>
                                            )}
                                            {isAssignedElsewhere && (
                                                <div className="elsewhere-tag">At: {stops.find(st => st.id === assignment.stop_id)?.stop_name}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RouteManagement;