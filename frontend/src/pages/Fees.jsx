import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS, BASE_URL } from '../config';
import './Fees.css';
import './OccasionalCollection.css';
import socket, { joinInstituteRoom } from '../socket';

import { useNavigate } from 'react-router-dom';
import ReceiptModal from '../components/ReceiptModal';

const Fees = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem('userData')));
    const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' or 'occasional'
    const [currentMonth, setCurrentMonth] = useState(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));

    const userType = localStorage.getItem('userType');
    const instituteId = userType === 'principal' ? userData?.id : userData?.institute_id;

    // Monthly Fees State
    const [columns, setColumns] = useState([]);
    const [classData, setClassData] = useState({});
    const [classes, setClasses] = useState([]);
    const [trackingData, setTrackingData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sectionData, setSectionData] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);

    // Manual Payment (Counter) State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedStudentForPay, setSelectedStudentForPay] = useState(null);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);

    // Defaulters State
    const [isDefaulterOpen, setIsDefaulterOpen] = useState(false);
    const [defaultersList, setDefaultersList] = useState([]);
    const [isDefaulterLoading, setIsDefaulterLoading] = useState(false);
    // Receipt State
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [defaulterClassFilter, setDefaulterClassFilter] = useState('ALL');

    useEffect(() => {
        if (instituteId) {
            joinInstituteRoom(instituteId);
        }
        socket.on('fee_payment_update', (data) => {
            fetchTracking();
            if (selectedClass) fetchSectionDetails(selectedClass);
            setDefaultersList(prev => prev.filter(st => st.fee_id !== data.studentFeeId));
        });
        return () => socket.off('fee_payment_update');
    }, [instituteId, selectedClass, currentMonth]);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                const endpoint = userType === 'principal' ? API_ENDPOINTS.PRINCIPAL : API_ENDPOINTS.AUTH.TEACHER;
                const response = await axios.get(`${endpoint}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const profile = response.data.profile || response.data.teacher;
                setUserData(profile);
                localStorage.setItem('userData', JSON.stringify(profile));
            } catch (error) {
                console.error('Fetch profile error:', error);
            }
        };
        fetchProfile();
    }, [currentMonth]);

    useEffect(() => {
        if (instituteId) {
            fetchClasses();
            fetchMonthlyConfig();
            fetchTracking();
        }
    }, [instituteId, currentMonth]);

    const fetchClasses = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const uniqueClasses = [...new Set(response.data.students.map(s => s.class))].sort();
            setClasses(uniqueClasses);
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const fetchMonthlyConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.FEES}/config/${instituteId}?month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data) {
                setColumns(response.data.columns || []);
                setClassData(response.data.class_data || {});
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    };

    const fetchTracking = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.FEES}/tracking/${instituteId}?month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTrackingData(response.data);
        } catch (error) {
            console.error('Error fetching tracking:', error);
        }
    };

    const fetchSectionDetails = async (className) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.FEES}/section/${instituteId}/${className}/ALL?month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSectionData(response.data);
        } catch (error) {
            console.error('Error fetching section details:', error);
            toast.error('Failed to fetch student details');
        }
    };

    const handleSearchStudent = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const endpoint = activeTab === 'monthly' 
                ? `${API_ENDPOINTS.FEES}/search-students/${instituteId}`
                : `${API_ENDPOINTS.FEES}/occasional-search/${instituteId}`;
            
            const response = await axios.get(`${endpoint}?query=${query}&month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(response.data);
        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const handleMarkAsPaid = async (student = null) => {
        const target = student || selectedStudentForPay;
        if (!target) return;

        setIsMarkingPaid(true);
        try {
            const token = localStorage.getItem('token');
            const collectorName = userType === 'principal' ? (userData?.principal_name || userData?.name) : userData?.name;

            if (activeTab === 'monthly') {
                const feeId = target.fee_id || target.fee_record_id || 'null';
                await axios.put(`${API_ENDPOINTS.FEES}/manual-pay/${feeId}`, {
                    instituteId: instituteId,
                    studentId: target.student_id || target.id,
                    month_year: currentMonth,
                    collectedBy: collectorName
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                // Occasional Manual Pay (per batch/student)
                const studentId = target.student_id || target.id;
                const batchId = target.batch_id || (target.occasional_fees && target.occasional_fees[0]?.batch_id);
                
                if (!batchId) {
                    toast.error('Could not identify batch for payment');
                    return;
                }

                await axios.put(`${API_ENDPOINTS.FEES}/occasional-batch-pay/${instituteId}`, {
                    batch_id: batchId,
                    student_id: studentId,
                    collectedBy: collectorName
                }, { headers: { Authorization: `Bearer ${token}` } });
            }

            toast.success('Fees marked as paid');
            if (isSearchOpen) setIsSearchOpen(false);
            setSelectedStudentForPay(null);
            fetchTracking();
            if (selectedClass) fetchSectionDetails(selectedClass); 
            if (activeTab === 'occasional') {
                // If there's a way to refresh occasional history/batches, do it
                // Since OccasionalTabContent is a separate component, we might need a refresh trigger
            }
        } catch (error) {
            toast.error('Failed to mark payment');
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const fetchDefaulters = async () => {
        setIsDefaulterLoading(true);
        try {
            const token = localStorage.getItem('token');
            const endpoint = activeTab === 'monthly' 
                ? `${API_ENDPOINTS.FEES}/defaulters/${instituteId}`
                : `${API_ENDPOINTS.FEES}/occasional-defaulters/${instituteId}`;

            const response = await axios.get(`${endpoint}?month=${currentMonth}&className=${defaulterClassFilter}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDefaultersList(response.data);
        } catch (error) {
            toast.error('Failed to fetch defaulters');
        } finally {
            setIsDefaulterLoading(false);
        }
    };

    useEffect(() => {
        if (isDefaulterOpen) fetchDefaulters();
    }, [isDefaulterOpen, currentMonth, defaulterClassFilter]);

    const handleMonthChange = (direction) => {
        const date = new Date(currentMonth);
        date.setMonth(date.getMonth() + direction);
        setCurrentMonth(date.toLocaleString('default', { month: 'long', year: 'numeric' }));
    };

    const saveAndPublish = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.FEES}/publish/${instituteId}`, {
                month_year: currentMonth,
                columns,
                class_data: classData
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Fees published successfully!');
            fetchTracking();
        } catch (error) {
            toast.error('Failed to publish fees');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fees-page-container">
            <header className="fees-header">
                <div>
                    <h2>Fees Management</h2>
                    <div className="tab-switcher-modern">
                        <button
                            className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
                            onClick={() => setActiveTab('monthly')}
                        >
                            Monthly Setup
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'occasional' ? 'active' : ''}`}
                            onClick={() => setActiveTab('occasional')}
                        >
                            Occasional Collection
                        </button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="defaulter-btn" onClick={() => setIsDefaulterOpen(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /></svg>
                        Defaulters
                    </button>
                    <button className="mark-fees-btn" onClick={() => setIsSearchOpen(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                        Manual Pay
                    </button>
                    <div className="month-selector-modern">
                        <button className="month-nav-btn" onClick={() => handleMonthChange(-1)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        <span className="current-month-display">{currentMonth}</span>
                        <button className="month-nav-btn" onClick={() => handleMonthChange(1)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                    </div>
                </div>
            </header>

            {activeTab === 'monthly' ? (
                <>
                    <section className="master-fees-grid-container">
                        <div className="grid-actions">
                            <button className="add-col-btn" onClick={() => {
                                const colName = prompt('Enter column name:');
                                if (colName && !columns.includes(colName)) setColumns([...columns, colName]);
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Add Column
                            </button>
                            <button className="publish-fees-btn" onClick={saveAndPublish} disabled={isLoading}>
                                {isLoading ? 'Publishing...' : 'Publish ' + currentMonth}
                            </button>
                        </div>

                        <div className="fees-table-wrapper">
                            <table className="fees-master-table">
                                <thead>
                                    <tr>
                                        <th>Class</th>
                                        {columns.map(col => (
                                            <th key={col}>
                                                <div className="col-header">
                                                    {col}
                                                    <button className="remove-col-btn" onClick={() => setColumns(columns.filter(c => c !== col))}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {classes.map(cls => (
                                        <tr key={cls}>
                                            <td className="class-label">{cls}</td>
                                            {columns.map(col => (
                                                <td key={col}>
                                                    <input
                                                        type="number"
                                                        className="fee-input"
                                                        placeholder="0"
                                                        value={classData[cls]?.[col] || ''}
                                                        onChange={(e) => setClassData(p => ({ ...p, [cls]: { ...(p[cls] || {}), [col]: e.target.value } }))}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <h3 style={{ marginTop: '3rem', fontSize: '1.5rem', fontWeight: '800' }}>Collection Tracking</h3>
                    <div className="tracking-grid">
                        {trackingData.map(track => {
                            const rate = track.total_expected > 0 ? (track.total_collected / track.total_expected * 100).toFixed(1) : 0;
                            return (
                                <div key={track.class} className="class-track-card" onClick={() => { setSelectedClass(track.class); fetchSectionDetails(track.class); }}>
                                    <div className="card-header">
                                        <h3>{track.class}</h3>
                                        <span className="collection-badge">{rate}% Collected</span>
                                    </div>
                                    <div className="track-stats">
                                        <div className="stat-item"><label>Students</label><span>{track.total_students}</span></div>
                                        <div className="stat-item"><label>Paid</label><span style={{ color: '#10b981' }}>{track.paid_count}</span></div>
                                        <div className="stat-item"><label>Expected</label><span>₹{track.total_expected}</span></div>
                                        <div className="stat-item"><label>Collected</label><span style={{ color: '#6366f1' }}>₹{track.total_collected}</span></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <OccasionalTabContent
                    userData={userData}
                    currentMonth={currentMonth}
                    classes={classes}
                    onActionComplete={fetchTracking}
                />
            )}

            {/* Manual Pay Search Modal */}
            {isSearchOpen && (
                <div className="detail-modal-overlay" onClick={() => { setIsSearchOpen(false); setSelectedStudentForPay(null); }}>
                    <div className="detail-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div><h3>Counter Fee Payment</h3><p className="text-secondary">{currentMonth}</p></div>
                            <button className="close-btn" onClick={() => { setIsSearchOpen(false); setSelectedStudentForPay(null); }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            {!selectedStudentForPay ? (
                                <>
                                    <div className="search-box-premium">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                        <input type="text" placeholder="Search student name..." value={searchQuery} onChange={(e) => handleSearchStudent(e.target.value)} autoFocus />
                                    </div>
                                    <div className="search-results-list">
                                        {searchResults.map(st => (
                                            <div key={st.student_id} className="search-item-premium" onClick={() => setSelectedStudentForPay(st)}>
                                                <div className="st-info-main"><span className="st-name-main">{st.name}</span><span className="st-meta-main">{st.class} {st.section} | Roll: {st.roll_no}</span></div>
                                                <div className="st-status-badge">{st.status === 'paid' ? <span className="p-success">Paid</span> : <span className="p-pending">Pending</span>}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="payment-confirmation-view">
                                    <div className="selected-st-header"><h4>{selectedStudentForPay.name}</h4><p>{selectedStudentForPay.class} - {selectedStudentForPay.section}</p></div>
                                    <div className="fees-breakdown-calc">
                                        <span className="section-title">Breakdown</span>
                                        {selectedStudentForPay.breakdown && Object.entries(selectedStudentForPay.breakdown).map(([l, a]) => (
                                            <div key={l} className="calc-row"><label>{l}</label><span>₹{a}</span></div>
                                        ))}
                                        <div className="calc-total-row"><label>Total</label><span>₹{selectedStudentForPay.total_amount}</span></div>
                                    </div>
                                    <div className="modal-actions-manual">
                                        <button className="back-btn-minimal" onClick={() => setSelectedStudentForPay(null)}>Back</button>
                                        <button className="mark-paid-confirm-btn" onClick={handleMarkAsPaid} disabled={isMarkingPaid || selectedStudentForPay.status === 'paid'}>
                                            {isMarkingPaid ? 'Processing...' : 'Collect ₹' + selectedStudentForPay.total_amount}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Defaulters Modal */}
            {isDefaulterOpen && (
                <div className="detail-modal-overlay" onClick={() => setIsDefaulterOpen(false)}>
                    <div className="detail-modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="defaulter-header-info">
                                <div className="defaulter-count-badge"><span>{defaultersList.length}</span>Defaulters</div>
                                <div style={{ marginLeft: '1rem' }}><h3>Defaulters List</h3><p className="text-secondary">{currentMonth}</p></div>
                                <div className="class-filter-container">
                                    <select value={defaulterClassFilter} onChange={(e) => setDefaulterClassFilter(e.target.value)} className="def-class-select">
                                        <option value="ALL">All Classes</option>
                                        {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button className="close-btn" onClick={() => setIsDefaulterOpen(false)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                        </div>
                        <div className="modal-body">
                            {isDefaulterLoading ? <p>Loading...</p> : (
                                <div className="defaulter-grid-list">
                                    {defaultersList.map(st => (
                                        <div key={st.student_id} className="defaulter-item-card">
                                            <div className="def-st-details"><span className="def-name">{st.name}</span><span className="def-meta">Class: {st.class}-{st.section} | Roll: {st.roll_no}</span></div>
                                            <div className="def-amt-info"><label>Unpaid</label><span>₹{st.total_amount}</span></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Drill down modal */}
            {selectedClass && (
                <div className="detail-modal-overlay" onClick={() => setSelectedClass(null)}>
                    <div className="detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div><h3>{selectedClass} Report</h3><p className="text-secondary">{currentMonth}</p></div>
                            <button className="close-btn" onClick={() => setSelectedClass(null)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-table-wrapper">
                                <table className="detail-report-table">
                                    <thead><tr><th>Roll</th><th>Name</th><th>Sec</th><th>Due</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                                    <tbody>{sectionData.map(s => (
                                        <tr key={s.id}>
                                            <td>{s.roll_no}</td>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.section}</td>
                                            <td>₹{s.total_amount}</td>
                                            <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                {s.status !== 'paid' && (
                                                    <button className="mini-pay-btn" onClick={() => handleMarkAsPaid(s)}>Collect</button>
                                                )}
                                                {s.status === 'paid' && (
                                                    <button className="view-receipt-btn-small" onClick={() => setSelectedReceipt({
                                                        ...s,
                                                        month_year: currentMonth,
                                                        breakdown: s.breakdown || {} // Ensure breakdown exists
                                                    })}>
                                                        View Receipt
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ReceiptModal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                feeRecord={selectedReceipt}
                userData={userData}
            />
        </div>
    );
};

const OccasionalTabContent = ({ userData, currentMonth, classes, onActionComplete }) => {
    const userType = localStorage.getItem('userType');
    const instituteId = userType === 'principal' ? userData?.id : userData?.institute_id;

    // Receipt State
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    // Selection state
    const [selectedClass, setSelectedClass] = useState('ALL');
    const [selectedSection, setSelectedSection] = useState('ALL');
    const [allStudents, setAllStudents] = useState([]);
    const [availableSections, setAvailableSections] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [selectedStudentsData, setSelectedStudentsData] = useState([]);

    // Billing items
    const [lineItems, setLineItems] = useState([{ fee_name: '', amount: '' }]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [history, setHistory] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal/View states
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchDetails, setBatchDetails] = useState([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    // Force reload students if instituteId or month changes
    useEffect(() => {
        if (instituteId) {
            fetchAllStudents();
            fetchHistory();
        }
    }, [instituteId, currentMonth]);

    const fetchAllStudents = async () => {
        setIsLoadingStudents(true);
        try {
            const token = localStorage.getItem('token');
            const endpoint = userType === 'principal' ? API_ENDPOINTS.PRINCIPAL : API_ENDPOINTS.TEACHER;
            const res = await axios.get(`${endpoint}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllStudents(res.data.students || []);
        } catch (e) {
            console.error('Error fetching students:', e);
            toast.error('Failed to load students');
        } finally {
            setIsLoadingStudents(false);
        }
    };

    useEffect(() => {
        if (selectedClass === 'ALL') {
            setAvailableSections([]);
            setSelectedSection('ALL');
        } else {
            const sections = [...new Set(allStudents.filter(s => s.class === selectedClass).map(s => s.section))].sort();
            setAvailableSections(sections);
            if (!sections.includes(selectedSection)) setSelectedSection('ALL');
        }
    }, [selectedClass, allStudents]);

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_ENDPOINTS.FEES}/occasional-history/${instituteId}?month=${currentMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchBatchDetails = async (batch) => {
        try {
            setSelectedBatch(batch);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_ENDPOINTS.FEES}/occasional-details/${instituteId}?batch_id=${batch.batch_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBatchDetails(res.data);
        } catch (e) { console.error(e); }
    };

    const handleMarkPaid = async (studentId) => {
        try {
            const token = localStorage.getItem('token');
            const collectorName = userType === 'principal' ? (userData?.principal_name || userData?.name) : userData?.name;

            await axios.put(`${API_ENDPOINTS.FEES}/occasional-batch-pay/${instituteId}`, {
                batch_id: selectedBatch.batch_id,
                student_id: studentId,
                collectedBy: collectorName
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success('Fees marked as paid');
            if (selectedBatch) fetchBatchDetails(selectedBatch);
            fetchHistory();
        } catch (err) { toast.error('Failed to update status'); }
    };

    const handleAddLineItem = () => setLineItems([...lineItems, { fee_name: '', amount: '' }]);
    const handleRemoveLineItem = (index) => setLineItems(lineItems.filter((_, i) => i !== index));
    const handleUpdateLineItem = (index, field, value) => {
        const newItems = [...lineItems];
        newItems[index][field] = value;
        setLineItems(newItems);
    };

    const toggleStudentSelection = (student) => {
        const id = student.id;
        if (selectedStudentIds.includes(id)) {
            setSelectedStudentIds(p => p.filter(i => i !== id));
            setSelectedStudentsData(p => p.filter(s => s.id !== id));
        } else {
            setSelectedStudentIds(p => [...p, id]);
            setSelectedStudentsData(p => [...p, student]);
        }
    };

    const handleSelectAllFiltered = (filteredList) => {
        const filteredIds = filteredList.map(s => s.id);
        const allSelected = filteredIds.every(id => selectedStudentIds.includes(id));

        if (allSelected) {
            // Deselect all in filtered list
            setSelectedStudentIds(p => p.filter(id => !filteredIds.includes(id)));
            setSelectedStudentsData(p => p.filter(s => !filteredIds.includes(s.id)));
        } else {
            // Select all in filtered list (avoid duplicates)
            const newIds = [...new Set([...selectedStudentIds, ...filteredIds])];
            const newStudents = [...selectedStudentsData];
            filteredList.forEach(s => {
                if (!selectedStudentIds.includes(s.id)) {
                    newStudents.push(s);
                }
            });
            setSelectedStudentIds(newIds);
            setSelectedStudentsData(newStudents);
        }
    };

    const handlePublish = async (e) => {
        e.preventDefault();
        if (selectedStudentIds.length === 0) return toast.warning('Select students first');

        const validCharges = lineItems.filter(item => item.fee_name.trim() !== '' && !isNaN(parseFloat(item.amount)));
        if (validCharges.length === 0) return toast.warning('Add at least one valid fee item');

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.FEES}/occasional/${instituteId}`, {
                studentIds: selectedStudentIds,
                month_year: currentMonth,
                charges: validCharges.map(c => ({ ...c, amount: parseFloat(c.amount) }))
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success('Occasional charges applied successfully');
            setLineItems([{ fee_name: '', amount: '' }]);
            setSelectedStudentIds([]);
            setSelectedStudentsData([]);
            fetchHistory();
            if (onActionComplete) onActionComplete();
        } catch (err) { toast.error('Failed to publish charges'); }
        finally { setIsSubmitting(false); }
    };

    const getFilteredStudents = () => {
        return allStudents.filter(s => {
            const matchesClass = selectedClass === 'ALL' || s.class === selectedClass;
            const matchesSection = selectedSection === 'ALL' || s.section === selectedSection;
            const matchesSearch = searchQuery === '' ||
                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.roll_no && s.roll_no.toString().includes(searchQuery));
            return matchesClass && matchesSection && matchesSearch;
        });
    };

    const totalPerStudent = lineItems.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const currentFilteredStudents = getFilteredStudents();
    const isAllFilteredSelected = currentFilteredStudents.length > 0 &&
        currentFilteredStudents.every(s => selectedStudentIds.includes(s.id));

    return (
        <div className="occ-premium-flow">
            <div className="occ-main-layout-container">
                {/* Left Side Panel: Setup & Summary */}
                <aside className="occ-side-panel">
                    <div className="setup-card-premium">
                        <div className="panel-header">
                            <label className="section-mini-label">Billing Setup</label>
                            <p className="panel-sub">Add fee names and amounts</p>
                        </div>

                        <div className="line-items-scroller">
                            {lineItems.map((item, idx) => (
                                <div key={idx} className="line-item-card-mini">
                                    <div className="line-item-row-wrapper">
                                        <div className="inputs-grid-dual">
                                            <input
                                                type="text"
                                                placeholder="Fee Name (e.g. Picnic)"
                                                value={item.fee_name}
                                                onChange={(e) => handleUpdateLineItem(idx, 'fee_name', e.target.value)}
                                                className="fee-name-input-unified"
                                            />
                                            <div className="amt-input-wrap-unified">
                                                <span className="curr-sym">₹</span>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={item.amount}
                                                    onChange={(e) => handleUpdateLineItem(idx, 'amount', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {lineItems.length > 1 && (
                                            <button className="remove-item-icon-btn" onClick={() => handleRemoveLineItem(idx)} aria-label="Remove item">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button className="add-line-ghost-btn" onClick={handleAddLineItem}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                Add More
                            </button>
                        </div>

                        <div className="publish-final-block">
                            <div className="summary-stats-box">
                                <div className="s-row">
                                    <span className="s-label">Students Selected</span>
                                    <span className="s-val">{selectedStudentIds.length}</span>
                                </div>
                                <div className="s-row">
                                    <span className="s-label">Total per Student</span>
                                    <span className="s-val highlight">₹{totalPerStudent}</span>
                                </div>
                            </div>
                            <button
                                className="publish-occ-btn-main"
                                onClick={handlePublish}
                                disabled={isSubmitting || selectedStudentIds.length === 0}
                            >
                                {isSubmitting ? 'Publishing...' : 'Publish Charges'}
                            </button>
                        </div>

                        <div className="selected-preview-mini">
                            <label className="section-mini-label">Selected ({selectedStudentIds.length})</label>
                            <div className="mini-chips-scroller">
                                {selectedStudentsData.map(s => (
                                    <div key={s.id} className="mini-st-chip">
                                        <span>{s.name}</span>
                                        <button onClick={() => toggleStudentSelection(s)}>×</button>
                                    </div>
                                ))}
                                {selectedStudentsData.length === 0 && <p className="no-sel-txt">None selected</p>}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area: Selection & Filters */}
                <main className="occ-center-panel">
                    <header className="occ-filter-toolbar">
                        <div className="toolbar-left">
                            <div className="filter-pill">
                                <label>Class</label>
                                <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                                    <option value="ALL">All Classes</option>
                                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="filter-pill">
                                <label>Section</label>
                                <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={selectedClass === 'ALL'}>
                                    <option value="ALL">All Sections</option>
                                    {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="search-pill">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                <input
                                    type="text"
                                    placeholder="Search by Name or Roll No..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="toolbar-right">
                            <div className="select-all-chk-wrap" onClick={() => handleSelectAllFiltered(currentFilteredStudents)}>
                                <div className={`custom-chk ${isAllFilteredSelected ? 'checked' : ''}`}>
                                    {isAllFilteredSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <span>Select All Filtered</span>
                            </div>
                        </div>
                    </header>

                    <div className="students-selection-viewport">
                        {isLoadingStudents ? (
                            <div className="occ-loading">Loading students...</div>
                        ) : currentFilteredStudents.length > 0 ? (
                            <div className="st-selection-list">
                                {currentFilteredStudents.map(s => (
                                    <div
                                        key={s.id}
                                        className={`st-selection-row ${selectedStudentIds.includes(s.id) ? 'selected' : ''}`}
                                        onClick={() => toggleStudentSelection(s)}
                                    >
                                        <div className={`row-chk ${selectedStudentIds.includes(s.id) ? 'checked' : ''}`}>
                                            {selectedStudentIds.includes(s.id) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </div>
                                        <img src={s.photo_url || 'https://via.placeholder.com/40'} alt="" className="st-row-avatar" />
                                        <div className="st-row-info">
                                            <span className="st-name">{s.name}</span>
                                            <span className="st-meta">Roll: {s.roll_no} | {s.class}-{s.section}</span>
                                        </div>
                                        <div className="row-status-tag">
                                            {selectedStudentIds.includes(s.id) ? 'Selected' : 'Click to Select'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="occ-empty-state">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                                <p>No students found matching your criteria</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <section className="occ-history-section">
                <h3 className="history-title">Previous Batch Collections</h3>
                <div className="flashcards-container">
                    {history.map((batch) => {
                        const date = new Date(batch.created_at);
                        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
                        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const progress = batch.total_expected > 0 ? (batch.total_collected / batch.total_expected * 100).toFixed(0) : 0;

                        return (
                            <div key={batch.batch_id} className={`batch-flashcard ${selectedBatch?.batch_id === batch.batch_id ? 'active' : ''}`} onClick={() => fetchBatchDetails(batch)}>
                                <div className="card-top">
                                    <div className="date-badge">
                                        <span className="day-name">{day}</span>
                                        <span className="full-date">{dateStr}</span>
                                    </div>
                                    <span className="time-stamp">{time}</span>
                                </div>
                                <div className="card-reasons">
                                    <label>Purpose</label>
                                    <p>{batch.reasons}</p>
                                </div>
                                <div className="card-stats">
                                    <div className="stat"><span>Students</span><label>{batch.student_count}</label></div>
                                    <div className="stat"><span>Expected</span><label>₹{batch.total_expected}</label></div>
                                    <div className="stat success"><span>Collected</span><label>₹{batch.total_collected}</label></div>
                                </div>
                                <div className="progress-group">
                                    <div className="progress-info">
                                        <span className="collection-status">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                                            Progress
                                        </span>
                                        <span className="collection-percent">{progress}%</span>
                                    </div>
                                    <div className="progress-bar-mini-container">
                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {selectedBatch && (
                <div className="batch-details-modal-overlay" onClick={() => setSelectedBatch(null)}>
                    <div className="batch-details-modal" onClick={e => e.stopPropagation()}>
                        <header className="modal-header-batch">
                            <div className="left">
                                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>Batch Details & Individual Collection</p>
                            </div>
                            <button className="close-btn-white" onClick={() => setSelectedBatch(null)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </header>
                        <div className="modal-body">
                            <div className="detail-table-wrapper-premium">
                                <table className="batch-table-modern">
                                    <thead>
                                        <tr>
                                            <th>Roll No</th>
                                            <th>Student Name</th>
                                            <th>Class & Section</th>
                                            <th>Fee Breakdown</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batchDetails.map(d => (
                                            <tr key={d.student_id} className={d.status}>
                                                <td>{d.roll_no}</td>
                                                <td className="st-name-bold">{d.name}</td>
                                                <td>{d.class}-{d.section}</td>
                                                <td>
                                                    <div className="batch-reason-display">{d.reasons || selectedBatch.reasons}</div>
                                                    <div className="batch-sum-display" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                                        {d.amount_breakdown} = <span style={{ color: '#10b981', fontWeight: 900 }}>₹{d.total_amount}</span>
                                                    </div>
                                                </td>
                                                <td><span className={`status-pill-batch ${d.status}`}>{d.status}</span></td>
                                                <td>
                                                    {d.status === 'unpaid' ? (
                                                        <button className="collect-btn-small" onClick={() => handleMarkPaid(d.student_id)}>
                                                            Collect Cash
                                                        </button>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span className="paid-icon-check">
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                                                                Paid
                                                            </span>
                                                            <button className="view-receipt-btn-small" onClick={() => {
                                                                // Reconstruct breakdown object from items and amount_breakdown strings
                                                                const items = d.items.split(' + ');
                                                                const amounts = d.amount_breakdown.split(' + ');
                                                                const breakdown = {};
                                                                items.forEach((item, idx) => {
                                                                    breakdown[item] = parseFloat(amounts[idx]);
                                                                });

                                                                setSelectedReceipt({
                                                                    ...d,
                                                                    month_year: currentMonth,
                                                                    breakdown: breakdown,
                                                                    total_amount: d.total_amount,
                                                                    fee_type: 'occasional',
                                                                    paid_at: d.paid_at,
                                                                    payment_id: d.payment_id,
                                                                    collected_by: d.collected_by
                                                                });
                                                            }}>
                                                                Receipt
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ReceiptModal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                feeRecord={selectedReceipt}
                userData={userData}
            />
        </div>
    );
};

export default Fees;
