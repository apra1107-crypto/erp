import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import { toast } from 'react-toastify';
import FeeReceiptModal from '../components/FeeReceiptModal';
import { downloadReceiptPDF } from '../utils/receiptGenerator';

const OneTimeFees = () => {
    const location = useLocation();
    const isTeacher = location.pathname.startsWith('/teacher-dashboard');
    const profileEndpoint = isTeacher ? API_ENDPOINTS.AUTH.TEACHER : API_ENDPOINTS.PRINCIPAL;
    const studentEndpoint = API_ENDPOINTS.PRINCIPAL; // Always use Principal endpoint for student list as it's staff-enabled

    // 1. DASHBOARD STATE
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [instituteData, setInstituteData] = useState(null);

    // 2. CREATION WIZARD STATE
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [reasonTitle, setReasonTitle] = useState('');
    const [reasonsList, setReasonsList] = useState([{ id: Date.now(), reason: '', amount: '' }]);
    const [selectedClasses, setSelectedClasses] = useState([]); // Array of strings
    const [classConfigs, setClassConfigs] = useState({}); // { '6-A': [{ reason, amount }, ...] }
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [creationSearch, setCreationSearch] = useState('');
    const [creationClassFilter, setCreationClassFilter] = useState('');
    const [creationSectionFilter, setCreationClassSectionFilter] = useState('');
    const [step, setStep] = useState(1); // 1: Details, 2: Students Selection, 3: Class Pricing
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editGroupId, setEditGroupId] = useState(null);

    // 8. DELETE CONFIRMATION STATE
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);

    // 3. DETAIL MODAL STATE
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupStudents, setGroupStudents] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailClassFilter, setDetailClassFilter] = useState('');
    const [detailLoading, setDetailLoading] = useState(false);

    // 4. COLLECTION MODAL STATE
    const [showCollectModal, setShowCollectModal] = useState(false);
    const [activePayment, setActivePayment] = useState(null);
    const [collectAmount, setCollectAmount] = useState('');

    // 5. OVERRIDE MODAL STATE
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overridePayment, setOverridePayment] = useState(null);
    const [overrideReasons, setOverrideReasons] = useState([]); // [{ reason, amount }, ...]

    // 6. RECEIPT STATE
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    // 7. TRANSACTION HISTORY MODAL STATE
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyStudent, setHistoryStudent] = useState(null);

    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchGroups();
        fetchInstituteProfile();
        fetchAvailableStudents();
    }, []);

    const fetchInstituteProfile = async () => {
        try {
            const response = await axios.get(`${profileEndpoint}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Profile data structure differs slightly between teacher and principal
            const profile = isTeacher ? response.data.teacher : response.data.profile;
            setInstituteData(profile);
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("OT_GROUPS_FETCH_SUCCESS:", response.data);
            setGroups(response.data.groups || []);
        } catch (error) {
            console.error("OT_GROUPS_FETCH_ERROR:", error.response || error);
            toast.error("Failed to load fee groups");
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableStudents = async () => {
        try {
            const response = await axios.get(`${studentEndpoint}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAvailableStudents(response.data.students || []);
        } catch (error) {
            console.error('Error fetching student list:', error);
        }
    };

    const fetchGroupDetails = async (group) => {
        setSelectedGroup(group);
        setDetailLoading(true);
        setShowDetailModal(true);
        try {
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/group-details/${group.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroupStudents(response.data.students || []);
        } catch (error) {
            toast.error("Failed to load students");
        } finally {
            setDetailLoading(false);
        }
    };

    // --- Creation Wizard Handlers ---
    const startCreation = () => {
        setReasonTitle('');
        setReasonsList([{ id: Date.now(), reason: '', amount: '' }]);
        setSelectedStudentIds([]);
        setSelectedClasses([]);
        setCreationSearch('');
        setCreationClassFilter('');
        setCreationClassSectionFilter('');
        setClassConfigs({});
        setStep(1);
        setIsEditing(false);
        setEditGroupId(null);
        setShowCreateModal(true);
    };

    const startEditing = async (group) => {
        setReasonTitle(group.reason);
        // Map reasons to include local IDs for builder rows
        setReasonsList(group.reasons.map(r => ({ ...r, id: Math.random() })));
        
        // Fetch current group details to get specific student IDs
        setLoading(true);
        try {
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/group-details/${group.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const currentStudents = response.data.students || [];
            setSelectedStudentIds(currentStudents.map(s => s.student_id));
            
            // Map class configs
            const classConfigsFromDetails = {};
            // We need to fetch class configs specifically if we want granular per-class breakdown
            // For now, we can derive it from student data or just use the default reasonsList
            // Better: use the reasonsList we just set
            
            setIsEditing(true);
            setEditGroupId(group.id);
            setStep(1);
            setShowCreateModal(true);
        } catch (error) {
            toast.error("Failed to load group for editing");
        } finally {
            setLoading(false);
        }
    };

    const addReasonRow = () => setReasonsList([...reasonsList, { id: Date.now(), reason: '', amount: '' }]);
    const removeReasonRow = (id) => setReasonsList(reasonsList.filter(r => r.id !== id));
    const updateReasonRow = (id, field, value) => setReasonsList(reasonsList.map(r => r.id === id ? { ...r, [field]: value } : r));

    // Calculate unique classes based on selected students
    useEffect(() => {
        if (step === 3) {
            const classesOfSelected = [...new Set(availableStudents.filter(s => selectedStudentIds.includes(s.id)).map(s => s.class))].sort();
            setSelectedClasses(classesOfSelected);
            
            const newConfigs = {};
            classesOfSelected.forEach(cls => {
                newConfigs[cls] = classConfigs[cls] || reasonsList.map(r => ({ ...r }));
            });
            setClassConfigs(newConfigs);
        }
    }, [step, selectedStudentIds, availableStudents]);

    const updateClassReasonAmount = (cls, reasonId, amount) => {
        setClassConfigs({
            ...classConfigs,
            [cls]: classConfigs[cls].map(r => r.id === reasonId ? { ...r, amount } : r)
        });
    };

    const handlePublish = async () => {
        const validReasons = reasonsList.filter(r => r.reason && r.amount);
        if (validReasons.length === 0 || selectedStudentIds.length === 0) return;

        setSubmitting(true);
        try {
            const finalClassConfigs = selectedClasses.map(cls => ({
                className: cls,
                reasons: classConfigs[cls].map(r => ({ reason: r.reason, amount: parseFloat(r.amount) }))
            }));

            const payload = {
                reason: reasonTitle,
                reasonsBreakdown: validReasons.map(r => ({ reason: r.reason, amount: parseFloat(r.amount) })),
                classConfigs: finalClassConfigs,
                studentIds: selectedStudentIds
            };

            if (isEditing) {
                await axios.put(`${API_ENDPOINTS.ONE_TIME_FEES}/update/${editGroupId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success("Fee group updated successfully!");
            } else {
                await axios.post(`${API_ENDPOINTS.ONE_TIME_FEES}/publish`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success("One-time fees published successfully!");
            }

            setShowCreateModal(false);
            fetchGroups();
        } catch (error) {
            toast.error(isEditing ? "Failed to update fees" : "Failed to publish fees");
        } finally {
            setSubmitting(false);
        }
    };

    // --- Receipt ---
    const openReceipt = (student) => {
        setReceiptData({
            institute: instituteData,
            student: { ...student, id: student.student_id },
            payment: { 
                paid_at: student.updated_at, 
                payment_method: student.transactions?.[0]?.payment_method || 'Cash', 
                collected_by: student.transactions?.[0]?.collected_by || 'Principal',
                paid_amount: student.paid_amount,
                due_amount: student.due_amount,
                transactions: student.transactions
            },
            breakage: student.breakdown || [{ label: selectedGroup.reason, amount: student.due_amount }],
            type: 'ONE-TIME'
        });
        setShowReceipt(true);
    };

    const handleDownloadReceipt = async (student) => {
        try {
            toast.info("Generating PDF receipt...");
            await downloadReceiptPDF({
                institute: instituteData,
                student: { ...student, id: student.student_id },
                payment: { 
                    paid_at: student.updated_at, 
                    payment_method: student.transactions?.[0]?.payment_method || 'Cash', 
                    collected_by: student.transactions?.[0]?.collected_by || 'Principal',
                    paid_amount: student.paid_amount,
                    due_amount: student.due_amount,
                    transactions: student.transactions
                },
                breakage: student.breakdown || [{ label: selectedGroup.reason, amount: student.due_amount }],
                type: 'ONE-TIME',
                months: [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ]
            });
            toast.success("Receipt downloaded successfully!");
        } catch (error) {
            console.error("PDF Download Error:", error);
            toast.error(`Download failed: ${error.message || 'Unknown error'}`);
        }
    };

    // --- Collection Handlers ---
    const handleCollect = async () => {
        if (!collectAmount || isNaN(collectAmount)) return;
        setSubmitting(true);
        try {
            await axios.post(`${API_ENDPOINTS.ONE_TIME_FEES}/collect/${activePayment.id}`, {
                amountReceived: parseFloat(collectAmount)
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Payment recorded");
            setShowCollectModal(false);
            fetchGroupDetails(selectedGroup);
            fetchGroups();
        } catch (error) {
            toast.error("Failed to update payment");
        } finally {
            setSubmitting(false);
        }
    };

    // --- Override Handlers ---
    const handleOverride = async () => {
        if (overrideReasons.length === 0) return;
        setSubmitting(true);
        try {
            await axios.patch(`${API_ENDPOINTS.ONE_TIME_FEES}/override/${overridePayment.id}`, {
                reasons: overrideReasons.map(r => ({ reason: r.reason, amount: parseFloat(r.amount) }))
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success("Amount overridden");
            setShowOverrideModal(false);
            fetchGroupDetails(selectedGroup);
            fetchGroups();
        } catch (error) {
            toast.error("Override failed");
        } finally {
            setSubmitting(false);
        }
    };

    const updateOverrideReasonAmount = (idx, amount) => {
        const newList = [...overrideReasons];
        newList[idx].amount = amount;
        setOverrideReasons(newList);
    };

    // --- Filtered Views ---
    const filteredDashboardGroups = useMemo(() => groups, [groups]);

    const filteredStudentsInGroup = useMemo(() => {
        return groupStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(detailSearch.toLowerCase()) || (s.roll_no || '').toString().includes(detailSearch);
            const matchesClass = detailClassFilter === '' || s.class === detailClassFilter;
            return matchesSearch && matchesClass;
        });
    }, [groupStudents, detailSearch, detailClassFilter]);

    // Available classes from the student list
    const availableClasses = useMemo(() => {
        return [...new Set(availableStudents.map(s => s.class))].sort();
    }, [availableStudents]);

    const filteredCreationStudents = useMemo(() => {
        return availableStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(creationSearch.toLowerCase()) || (s.roll_no || '').toString().includes(creationSearch);
            const matchesClass = creationClassFilter === '' || s.class === creationClassFilter;
            const matchesSection = creationSectionFilter === '' || s.section === creationSectionFilter;
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [availableStudents, creationSearch, creationClassFilter, creationSectionFilter]);

    const toggleStudentSelection = (id) => {
        setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };

    const selectAllFiltered = () => {
        const filteredIds = filteredCreationStudents.map(s => s.id);
        setSelectedStudentIds(prev => [...new Set([...prev, ...filteredIds])]);
    };

    const clearAllSelection = () => setSelectedStudentIds([]);

    // --- Delete Handler ---
    const handleDeleteGroup = async () => {
        if (!groupToDelete) return;
        setSubmitting(true);
        try {
            await axios.delete(`${API_ENDPOINTS.ONE_TIME_FEES}/delete/${groupToDelete.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Fee campaign deleted");
            setShowDeleteModal(false);
            setGroupToDelete(null);
            fetchGroups();
        } catch (error) {
            toast.error("Failed to delete campaign");
        } finally {
            setSubmitting(false);
        }
    };

    // Creation Step 2 logic: Select students by class removed - replaced by manual selection with filters
    useEffect(() => {
        // No longer auto-filling based on selectedClasses array
    }, []);

    return (
        <div className="onetime-fees-section animate-fade-in">
            {/* 1. TOP HEADER & ACTION */}
            <div className="ot-dashboard-header">
                <button className="ot-create-trigger-btn" onClick={startCreation}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Create New Fee
                </button>
            </div>

            {/* 2. FLASHCARD GALLERY */}
            {loading ? (
                <div className="ot-loading-placeholder">Loading campaigns...</div>
            ) : groups.length === 0 ? (
                <div className="ot-empty-state">
                    <div className="empty-icon">💸</div>
                    <h4>No One-Time Fees Yet</h4>
                    <p>Click "Create New Fee" to start a collection campaign for exam fees, uniforms, or events.</p>
                </div>
            ) : (
                <div className="ot-flashcard-grid">
                    {groups.map(g => {
                        const progress = (parseFloat(g.collected_total) / parseFloat(g.expected_total)) * 100 || 0;
                        const date = new Date(g.created_at);
                        return (
                            <div key={g.id} className="ot-flashcard" onClick={() => fetchGroupDetails(g)}>
                                <div className="ot-card-top">
                                    <div className="ot-card-date">
                                        <span className="day">{date.toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                                        <span className="time">{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="ot-card-status-pill">Active</div>
                                    <button 
                                        className="ot-card-edit-btn" 
                                        onClick={(e) => { e.stopPropagation(); startEditing(g); }}
                                        title="Edit Fee Campaign"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button 
                                        className="ot-card-delete-btn" 
                                        onClick={(e) => { e.stopPropagation(); setGroupToDelete(g); setShowDeleteModal(true); }}
                                        title="Delete Fee Campaign"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                                
                                <h2 className="ot-card-reason">{g.reason}</h2>
                                
                                <div className="ot-card-breakdown-display">
                                    {g.reasons && Array.isArray(g.reasons) && g.reasons.map((r, i) => (
                                        <div key={i} className="ot-breakdown-row-mini">
                                            <span>{r.reason}</span>
                                            <strong>₹{parseFloat(r.amount).toLocaleString()}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className="ot-card-classes-row">
                                    {g.classes.map(c => <span key={c} className="class-tag">{c}</span>)}
                                </div>

                                <div className="ot-card-stats-grid">
                                    <div className="stat-box">
                                        <label>Expected</label>
                                        <strong>₹{parseFloat(g.expected_total).toLocaleString()}</strong>
                                    </div>
                                    <div className="stat-box">
                                        <label>Collected</label>
                                        <strong className="collected-text">₹{parseFloat(g.collected_total).toLocaleString()}</strong>
                                    </div>
                                    <div className="stat-box">
                                        <label>Students</label>
                                        <strong>{g.student_count}</strong>
                                    </div>
                                </div>

                                <div className="ot-card-progress-section">
                                    <div className="progress-label">
                                        <span>Collection Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="ot-card-footer">
                                    <span>Created: {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                    <span className="view-more">View Details →</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 3. CREATION WIZARD MODAL */}
            {showCreateModal && (
                <div className="fee-modal-overlay">
                    <div className="ot-wizard-modal">
                        <div className="wizard-header">
                            <div className="wizard-steps-indicator">
                                <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
                                <div className="step-line"></div>
                                <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
                                <div className="step-line"></div>
                                <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                            </div>
                            <h3>{isEditing ? 'Edit ' : ''}{step === 1 ? 'Fee Details' : step === 2 ? 'Select Students' : 'Class Pricing'}</h3>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>

                        <div className="wizard-body">
                            {step === 1 && (
                                <div className="step-content animate-slide-right">
                                    <div className="input-group">
                                        <label>Fee Title</label>
                                        <input type="text" placeholder="e.g. Annual Exam 2026" value={reasonTitle} onChange={e => setReasonTitle(e.target.value)} />
                                    </div>
                                    <div className="reasons-builder-area">
                                        <div className="builder-header">
                                            <label>Fee Structure (Reasons & Amounts)</label>
                                            <button className="add-row-btn" onClick={addReasonRow}>+ Add Reason</button>
                                        </div>
                                        <div className="builder-rows">
                                            {reasonsList.map((r, idx) => (
                                                <div key={r.id} className="builder-row">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Reason (e.g. Lab Fee)" 
                                                        value={r.reason} 
                                                        onChange={e => updateReasonRow(r.id, 'reason', e.target.value)} 
                                                    />
                                                    <div className="amount-input-wrap-wizard">
                                                        ₹ <input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            value={r.amount} 
                                                            onChange={e => updateReasonRow(r.id, 'amount', e.target.value)} 
                                                        />
                                                    </div>
                                                    {reasonsList.length > 1 && (
                                                        <button className="remove-row-btn-wizard" onClick={() => removeReasonRow(r.id)}>×</button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="builder-total">
                                            <span>Default Total:</span>
                                            <strong>₹{reasonsList.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toLocaleString()}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="step-content animate-slide-right">
                                    <p className="step-desc">Target specific students, sections, or entire classes.</p>
                                    
                                    <div className="selection-filters-wizard">
                                        <div className="filter-row-wizard">
                                            <div className="search-box-wizard">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                                <input type="text" placeholder="Search by name/roll..." value={creationSearch} onChange={e => setCreationSearch(e.target.value)} />
                                            </div>
                                            <select value={creationClassFilter} onChange={e => setCreationClassFilter(e.target.value)}>
                                                <option value="">All Classes</option>
                                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <input type="text" className="sec-input-wizard" placeholder="Section" value={creationSectionFilter} onChange={e => setCreationClassSectionFilter(e.target.value)} />
                                        </div>
                                        <div className="selection-actions-wizard">
                                            <button className="select-all-btn-wizard" onClick={selectAllFiltered}>Select All Filtered</button>
                                            <button className="clear-btn-wizard" onClick={clearAllSelection}>Clear All ({selectedStudentIds.length})</button>
                                        </div>
                                    </div>

                                    <div className="students-selection-grid">
                                        {filteredCreationStudents.length === 0 ? (
                                            <div className="no-students-msg">No students found matching filters.</div>
                                        ) : (
                                            filteredCreationStudents.map(s => (
                                                <div 
                                                    key={s.id} 
                                                    className={`selection-card ${selectedStudentIds.includes(s.id) ? 'selected' : ''}`}
                                                    onClick={() => toggleStudentSelection(s.id)}
                                                >
                                                    <div className="check-box-wizard">{selectedStudentIds.includes(s.id) ? '✓' : ''}</div>
                                                    <img src={s.photo_url || 'https://via.placeholder.com/30'} alt="" />
                                                    <div className="s-info-mini">
                                                        <p className="s-name-mini">{s.name}</p>
                                                        <span className="s-meta-mini">{s.class}-{s.section} | R: {s.roll_no}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="selection-summary-wizard">
                                        <span>Total Students Selected: <strong>{selectedStudentIds.length}</strong></span>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="step-content animate-slide-right">
                                    <p className="step-desc">Confirm or adjust the breakdown for each class.</p>
                                    <div className="class-configs-list-wizard">
                                        {selectedClasses.map(cls => (
                                            <div key={cls} className="class-config-card-wizard">
                                                <div className="card-header-wizard">
                                                    <h4>Class {cls}</h4>
                                                    <strong>Total: ₹{classConfigs[cls]?.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toLocaleString()}</strong>
                                                </div>
                                                <div className="card-reasons-list">
                                                    {classConfigs[cls]?.map(r => (
                                                        <div key={r.id} className="class-reason-row">
                                                            <span>{r.reason}</span>
                                                            <div className="price-adjust-input">
                                                                ₹ <input 
                                                                    type="number" 
                                                                    value={r.amount} 
                                                                    onChange={e => updateClassReasonAmount(cls, r.id, e.target.value)} 
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="wizard-footer">
                            {step > 1 && <button className="wizard-back-btn" onClick={() => setStep(step - 1)}>Back</button>}
                            <button 
                                className="wizard-next-btn" 
                                disabled={submitting || (step === 1 && (!reasonTitle || reasonsList.some(r => !r.reason || !r.amount))) || (step === 2 && selectedStudentIds.length === 0)}
                                onClick={() => {
                                    if (step < 3) setStep(step + 1);
                                    else handlePublish();
                                }}
                            >
                                {submitting ? (isEditing ? 'Updating...' : 'Publishing...') : step === 3 ? (isEditing ? 'Confirm & Update' : 'Confirm & Publish') : 'Next Step'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. DETAIL MODAL (STUDENT LIST) */}
            {showDetailModal && selectedGroup && (
                <div className="fee-modal-overlay" onClick={() => setShowDetailModal(false)}>
                    <div className="ot-detail-view-modal" onClick={e => e.stopPropagation()}>
                        <div className="detail-header">
                            <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
                            <div className="header-top">
                                <div>
                                    <h2>{selectedGroup.reason}</h2>
                                    <p>Detailed Collection Status</p>
                                </div>
                            </div>
                            <div className="header-filters">
                                <div className="detail-search">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                    <input type="text" placeholder="Search student..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
                                </div>
                                <select value={detailClassFilter} onChange={e => setDetailClassFilter(e.target.value)}>
                                    <option value="">All Classes</option>
                                    {selectedGroup.classes.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="header-stats-mini">
                                    <div className="stat-mini"><span>Expected</span> <strong>₹{parseFloat(selectedGroup.expected_total).toLocaleString()}</strong></div>
                                    <div className="stat-mini"><span>Collected</span> <strong className="collected">₹{parseFloat(selectedGroup.collected_total).toLocaleString()}</strong></div>
                                </div>
                            </div>
                        </div>

                        <div className="detail-body">
                            {detailLoading ? (
                                <div className="detail-loader">Fetching student data...</div>
                            ) : (
                                <div className="detail-table-container">
                                    <table className="ot-detail-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class-Sec</th>
                                                <th>Roll No</th>
                                                <th>Amount Due</th>
                                                <th>Amount Paid</th>
                                                <th>Status</th>
                                                <th className="text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudentsInGroup.map(s => {
                                                const isPaid = s.status === 'paid';
                                                const isPartial = s.status === 'partial';
                                                return (
                                                    <tr key={s.id} className={isPaid ? 'row-fully-paid' : ''}>
                                                        <td>
                                                            <div className="td-student-info">
                                                                <img src={s.photo_url || 'https://via.placeholder.com/40'} alt="" />
                                                                <span>{s.name}</span>
                                                            </div>
                                                        </td>
                                                        <td>{s.class}-{s.section}</td>
                                                        <td>{s.roll_no}</td>
                                                        <td>
                                                            <div className="due-cell">
                                                                ₹{parseFloat(s.due_amount).toLocaleString()}
                                                                {!isPaid && (
                                                                    <button className="override-btn" onClick={() => { 
                                                                        setOverridePayment(s); 
                                                                        setOverrideReasons(s.breakdown ? s.breakdown.map(r => ({ ...r })) : [{ reason: selectedGroup.reason, amount: s.due_amount }]); 
                                                                        setShowOverrideModal(true); 
                                                                    }} title="Override Price">✎</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>₹{parseFloat(s.paid_amount).toLocaleString()}</td>
                                                        <td>
                                                            <div className="status-cell-flex">
                                                                <span className={`status-tag ${s.status}`}>
                                                                    {s.status === 'paid' ? '✔ Paid' : s.status === 'partial' ? 'Half Paid' : 'Unpaid'}
                                                                </span>
                                                                {s.status === 'partial' && (
                                                                    <button className="view-history-mini-btn" onClick={() => { setHistoryStudent(s); setShowHistoryModal(true); }} title="View Transaction History">ⓘ</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="text-center">
                                                            {isPaid ? (
                                                                <div className="td-action-paid">
                                                                    <button className="mini-receipt-btn" onClick={() => openReceipt(s)} title="View Receipt">📄</button>
                                                                    <button className="mini-download-btn" onClick={() => handleDownloadReceipt(s)} title="Download PDF">↓</button>
                                                                </div>
                                                            ) : (
                                                                <button className="td-collect-btn" onClick={() => { setActivePayment(s); setCollectAmount(''); setShowCollectModal(true); }}>
                                                                    Collect
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. MANUAL COLLECT MODAL (WITH AMOUNT INPUT) */}
            {showCollectModal && activePayment && (
                <div className="fee-modal-overlay">
                    <div className="ot-action-modal">
                        <div className="modal-top">
                            <h3>Collect Payment</h3>
                            <button className="close-btn" onClick={() => setShowCollectModal(false)}>×</button>
                        </div>
                        <div className="modal-mid">
                            <p>Collect payment from <strong>{activePayment.name}</strong></p>
                            <div className="bill-summary-mini">
                                <div className="bill-row"><span>Due Amount:</span> <strong>₹{parseFloat(activePayment.due_amount).toLocaleString()}</strong></div>
                                <div className="bill-row"><span>Already Paid:</span> <strong>₹{parseFloat(activePayment.paid_amount).toLocaleString()}</strong></div>
                                <div className="bill-row balance"><span>Remaining Balance:</span> <strong>₹{(parseFloat(activePayment.due_amount) - parseFloat(activePayment.paid_amount)).toLocaleString()}</strong></div>
                            </div>
                            <div className="amount-input-field">
                                <label>Enter Amount to Collect (₹)</label>
                                <input 
                                    type="number" 
                                    placeholder="Enter amount" 
                                    autoFocus
                                    value={collectAmount} 
                                    onChange={e => setCollectAmount(e.target.value)} 
                                />
                                <div className="quick-amount-btns">
                                    <button onClick={() => setCollectAmount(parseFloat(activePayment.due_amount) - parseFloat(activePayment.paid_amount))}>Collect Full Balance</button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-bot">
                            <button className="cancel-btn" onClick={() => setShowCollectModal(false)}>Cancel</button>
                            <button className="confirm-btn" disabled={submitting || !collectAmount} onClick={handleCollect}>
                                {submitting ? 'Processing...' : 'Confirm Collection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. OVERRIDE AMOUNT MODAL */}
            {showOverrideModal && overridePayment && (
                <div className="fee-modal-overlay">
                    <div className="ot-action-modal">
                        <button className="close-btn" onClick={() => setShowOverrideModal(false)}>×</button>
                        <div className="modal-top">
                            <h3>Override Price</h3>
                        </div>
                        <div className="modal-mid">
                            <p>Adjust specific amounts for <strong>{overridePayment.name}</strong>.</p>
                            <div className="override-reasons-list">
                                {overrideReasons.map((r, idx) => (
                                    <div key={idx} className="override-reason-row">
                                        <span>{r.reason}</span>
                                        <div className="price-input-wrap-mini">
                                            ₹ <input 
                                                type="number" 
                                                value={r.amount} 
                                                onChange={e => updateOverrideReasonAmount(idx, e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="override-total-display">
                                <span>New Total:</span>
                                <strong>₹{overrideReasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0).toLocaleString()}</strong>
                            </div>
                        </div>
                        <div className="modal-bot">
                            <button className="cancel-btn" onClick={() => setShowOverrideModal(false)}>Cancel</button>
                            <button className="confirm-btn" disabled={submitting || overrideReasons.some(r => !r.amount)} onClick={handleOverride}>
                                {submitting ? 'Updating...' : 'Save Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. RECEIPT MODAL */}
            {showHistoryModal && historyStudent && (
                <div className="fee-modal-overlay">
                    <div className="ot-action-modal history-modal-wide">
                        <div className="modal-top">
                            <h3>Transaction History</h3>
                            <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
                        </div>
                        <div className="modal-mid">
                            <div className="student-header-mini">
                                <img src={historyStudent.photo_url || 'https://via.placeholder.com/40'} alt="" />
                                <div>
                                    <h4>{historyStudent.name}</h4>
                                    <p>{historyStudent.class}-{historyStudent.section} | Roll: {historyStudent.roll_no}</p>
                                </div>
                            </div>

                            <div className="history-price-breakdown">
                                <div className="h-price-row">
                                    <span>Initial Amount:</span>
                                    <strong>₹{parseFloat(historyStudent.original_amount).toLocaleString()}</strong>
                                </div>
                                {Math.abs(parseFloat(historyStudent.due_amount) - parseFloat(historyStudent.original_amount)) > 0.01 && (
                                    <div className="h-price-row override">
                                        <span>Overridden Amount:</span>
                                        <strong>₹{parseFloat(historyStudent.due_amount).toLocaleString()}</strong>
                                    </div>
                                )}
                                <div className="h-price-row balance">
                                    <span>Total Collected:</span>
                                    <strong className="collected">₹{parseFloat(historyStudent.paid_amount).toLocaleString()}</strong>
                                </div>
                                <div className="h-price-row balance">
                                    <span>Remaining Balance:</span>
                                    <strong className="pending">₹{(parseFloat(historyStudent.due_amount) - parseFloat(historyStudent.paid_amount)).toLocaleString()}</strong>
                                </div>
                            </div>

                            <div className="transactions-list-area">
                                <label>Detailed Transactions</label>
                                {historyStudent.transactions && historyStudent.transactions.length > 0 ? (
                                    <div className="t-list-scroll">
                                        {historyStudent.transactions.map((t, i) => {
                                            const tDate = new Date(t.created_at);
                                            return (
                                                <div key={i} className="t-item-row">
                                                    <div className="t-left">
                                                        <span className="t-date">{tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                        <span className="t-time">{tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="t-mid">
                                                        <span className="t-method">{t.payment_method}</span>
                                                        <span className="t-by">By: {t.collected_by}</span>
                                                    </div>
                                                    <div className="t-right">
                                                        <strong>₹{parseFloat(t.amount).toLocaleString()}</strong>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="no-t-msg">No transactions recorded yet.</p>
                                )}
                            </div>
                        </div>
                        <div className="modal-bot">
                            <button className="confirm-btn" onClick={() => setShowHistoryModal(false)}>Close History</button>
                        </div>
                    </div>
                </div>
            )}

            {showReceipt && receiptData && (
                <FeeReceiptModal 
                    isOpen={showReceipt} 
                    onClose={() => setShowReceipt(false)} 
                    data={receiptData} 
                />
            )}

            {/* 8. DELETE CONFIRMATION MODAL */}
            {showDeleteModal && groupToDelete && (
                <div className="fee-modal-overlay">
                    <div className="ot-action-modal">
                        <div className="modal-top">
                            <h3>Delete Fee Campaign</h3>
                            <button className="close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
                        </div>
                        <div className="modal-mid">
                            <p>Are you sure you want to delete <strong>{groupToDelete.reason}</strong>?</p>
                            <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '10px' }}>
                                This action cannot be undone. All payment records and history for this fee will be permanently removed.
                            </p>
                        </div>
                        <div className="modal-bot">
                            <button className="cancel-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button className="confirm-btn" style={{ background: '#ef4444' }} disabled={submitting} onClick={handleDeleteGroup}>
                                {submitting ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OneTimeFees;
