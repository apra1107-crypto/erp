import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import './Transport.css';

// Import Icon
import busIcon from '../assets/icons/school-bus.png';

const Transport = () => {
    const navigate = useNavigate();
    const userType = localStorage.getItem('userType');
    
    let dashboardBase = '/dashboard';
    if (userType === 'teacher') dashboardBase = '/teacher-dashboard';
    else if (userType === 'student') dashboardBase = '/student-dashboard';
    
    // Permission check
    const storedUserData = localStorage.getItem('userData');
    const userData = storedUserData ? JSON.parse(storedUserData) : null;
    const hasFullAccess = userType === 'principal' || (userType === 'teacher' && userData?.special_permission);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [buses, setBuses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBusId, setEditingBusId] = useState(null);

    // Filter buses for students: show only the bus where the student is assigned
    const displayBuses = userType === 'student'
        ? buses.filter(bus => bus.assignments?.some(a => String(a.student_id) === String(userData?.id)))
        : buses;
    
    // Form State
    const [formData, setFormData] = useState({
        busNumber: '',
        driverName: '',
        driverMobile: '',
        staff: [{ name: '', mobile: '', role: 'Conductor' }]
    });

    useEffect(() => {
        fetchBuses();
    }, []);

    const fetchBuses = async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBuses(response.data.buses);
        } catch (error) {
            console.error('Error fetching buses:', error);
            toast.error('Failed to load buses');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddStaff = () => {
        setFormData({
            ...formData,
            staff: [...formData.staff, { name: '', mobile: '', role: 'Staff' }]
        });
    };

    const handleRemoveStaff = (index) => {
        const newStaff = formData.staff.filter((_, i) => i !== index);
        setFormData({ ...formData, staff: newStaff });
    };

    const handleStaffChange = (index, field, value) => {
        const newStaff = [...formData.staff];
        newStaff[index][field] = value;
        setFormData({ ...formData, staff: newStaff });
    };

    const handleOpenAddModal = () => {
        setEditingBusId(null);
        setFormData({
            busNumber: '',
            driverName: '',
            driverMobile: '',
            staff: [{ name: '', mobile: '', role: 'Conductor' }]
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (bus) => {
        setEditingBusId(bus.id);
        setFormData({
            busNumber: bus.bus_number,
            driverName: bus.driver_name,
            driverMobile: bus.driver_mobile,
            staff: bus.staff && bus.staff.length > 0 ? bus.staff : [{ name: '', mobile: '', role: 'Conductor' }]
        });
        setIsModalOpen(true);
    };

    const handleSaveBus = async () => {
        if (!formData.busNumber || !formData.driverName) {
            toast.warning('Bus number and Driver name are required');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (editingBusId) {
                const response = await axios.put(`${API_ENDPOINTS.TRANSPORT}/update/${editingBusId}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBuses(buses.map(b => b.id === editingBusId ? response.data.bus : b));
                toast.success('Bus updated successfully');
            } else {
                const response = await axios.post(`${API_ENDPOINTS.TRANSPORT}/add`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBuses([response.data.bus, ...buses]);
                toast.success('Bus registered successfully');
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving bus:', error);
            toast.error(error.response?.data?.message || 'Failed to save bus');
        }
    };

    const handleDeleteBus = async (id) => {
        if (!window.confirm('Are you sure you want to delete this bus?')) return;
        
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.TRANSPORT}/delete/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBuses(buses.filter(b => b.id !== id));
            toast.success('Bus deleted');
        } catch (error) {
            console.error('Error deleting bus:', error);
            toast.error('Failed to delete bus');
        }
    };

    return (
        <div className="transport-page">
            <div className="transport-header-row">
                <div className="header-left-group">
                    <button className="back-btn-minimal" onClick={() => navigate(dashboardBase)}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="transport-title-bold">{userType === 'student' ? 'My Transport' : 'Transport Management'}</h1>
                </div>
                {hasFullAccess && (
                    <button className="add-bus-btn" onClick={handleOpenAddModal}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Bus
                    </button>
                )}
            </div>

            <div className="buses-grid">
                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading transport data...</p>
                    </div>
                ) : displayBuses.length === 0 ? (
                    <div className="empty-transport-state">
                        <div className="empty-icon">🚌</div>
                        <p>
                            {userType === 'student' 
                                ? "You are not assigned to any transport route yet." 
                                : buses.length === 0 
                                    ? 'No buses registered yet.' 
                                    : 'No buses matching your criteria.'
                            }
                            <br />
                            {hasFullAccess ? 'Click "Add Bus" to begin.' : 'Please contact the institute administration for transport details.'}
                        </p>
                    </div>
                ) : (
                    displayBuses.map(bus => (
                        <div key={bus.id} className="bus-card animate-in">
                            <div className="bus-card-accent"></div>
                            
                            {hasFullAccess && (
                                <div className="bus-card-actions">
                                    <button className="card-action-btn edit" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(bus); }} title="Edit">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button className="card-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteBus(bus.id); }} title="Delete">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    </button>
                                </div>
                            )}

                            <div className="bus-card-header">
                                <div className="bus-icon-circle">
                                    <img src={busIcon} alt="Bus" className="card-bus-png" />
                                </div>
                                <div className="bus-meta">
                                    <span className="bus-number-label">BUS NUMBER</span>
                                    <h3 className="bus-number-val">{bus.bus_number}</h3>
                                </div>
                            </div>
                            
                            <div className="bus-card-body">
                                <div className="route-main-display" onClick={() => {
                                    const path = userType === 'student' ? '/student-dashboard' : dashboardBase;
                                    navigate(`${path}/transport/live/${bus.id}`);
                                }}>
                                    {bus.start_point && bus.end_point ? (
                                        <div className="route-path-visual-horizontal clickable-route">
                                            <div className="point-box start">
                                                <span className="p-label">FROM</span>
                                                <p className="p-name">{bus.start_point}</p>
                                            </div>
                                            <div className="path-arrow">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                            </div>
                                            <div className="point-box end">
                                                <span className="p-label">TO</span>
                                                <p className="p-name">{bus.end_point}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="no-route-placeholder-mini" onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (hasFullAccess) navigate(`${dashboardBase}/transport/route/${bus.id}`);
                                        }}>
                                            {hasFullAccess ? '⚠️ Route not configured. Click to setup.' : '⚠️ Route configuration pending.'}
                                        </div>
                                    )}
                                </div>

                                <div className="bus-staff-grid">
                                    <div className="staff-pill driver">
                                        <div className="pill-avatar">D</div>
                                        <div className="pill-info">
                                            <span className="pill-role">Driver</span>
                                            <p className="pill-name">{bus.driver_name}</p>
                                            <p className="pill-contact">{bus.driver_mobile}</p>
                                        </div>
                                    </div>
                                    
                                    {bus.staff && bus.staff.map((s, idx) => (
                                        <div key={idx} className="staff-pill helper">
                                            <div className="pill-avatar mini">H</div>
                                            <div className="pill-info">
                                                <span className="pill-role">{s.role}</span>
                                                <p className="pill-name-small">{s.name}</p>
                                                <p className="pill-contact-small">{s.mobile}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {hasFullAccess && (
                                <div className="bus-card-footer-info" onClick={() => navigate(`${dashboardBase}/transport/route/${bus.id}`)}>
                                    <span className="setup-hint">Configure Route, Stops & Students</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            {isModalOpen && (
                <div className="bus-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="bus-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingBusId ? 'Edit Bus Details' : 'Register New Bus'}</h2>
                            <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body scrollable">
                            <div className="form-group">
                                <label>Bus Number</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: MH 12 AB 1234" 
                                    value={formData.busNumber}
                                    onChange={(e) => setFormData({...formData, busNumber: e.target.value})}
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Driver Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Full Name" 
                                        value={formData.driverName}
                                        onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Driver Mobile</label>
                                    <input 
                                        type="text" 
                                        placeholder="+91" 
                                        value={formData.driverMobile}
                                        onChange={(e) => setFormData({...formData, driverMobile: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="divider-label">Other Staff (Conductors/Helpers)</div>
                            
                            {formData.staff.map((member, index) => (
                                <div key={index} className="staff-input-row">
                                    <input 
                                        type="text" 
                                        placeholder="Name" 
                                        value={member.name}
                                        onChange={(e) => handleStaffChange(index, 'name', e.target.value)}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Mobile" 
                                        value={member.mobile}
                                        onChange={(e) => handleStaffChange(index, 'mobile', e.target.value)}
                                    />
                                    {formData.staff.length > 1 && (
                                        <button className="remove-staff-btn" onClick={() => handleRemoveStaff(index)}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button className="add-staff-line-btn" onClick={handleAddStaff}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add another person
                            </button>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className="create-bus-confirm-btn" onClick={handleSaveBus}>
                                {editingBusId ? 'Update Flashcard' : 'Create Flashcard'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transport;
