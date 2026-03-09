import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_ENDPOINTS } from '../config';
import { toast } from 'react-toastify';
import FeeReceiptModal from '../components/FeeReceiptModal';
import { downloadReceiptPDF } from '../utils/receiptGenerator';
import OneTimeFees from './OneTimeFees';
import './Fees.css';

const Fees = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const today = new Date();
    
    // Core State
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || '');
    const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' or 'onetime'
    const [filters, setFilters] = useState({ class: '', section: '' });
    const [instituteData, setInstituteData] = useState(null);

    // Month & Year Selection
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Modal State
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showAddAmountModal, setShowAddAmountModal] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardCharges, setWizardCharges] = useState([{ reason: '', amount: '' }]);
    const [wizardSelection, setWizardSelection] = useState({ class: '', section: '', searchTerm: '' });
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

    // Filtered list for student selection in wizard
    const wizardFilteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(wizardSelection.searchTerm.toLowerCase()) || (s.roll_no || '').toString().includes(wizardSelection.searchTerm);
            const matchesClass = wizardSelection.class === '' || (s.class || '').toLowerCase() === wizardSelection.class.toLowerCase();
            const matchesSection = wizardSelection.section === '' || (s.section || '').toLowerCase() === wizardSelection.section.toLowerCase();
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [students, wizardSelection]);

    const openAddAmountModal = () => {
        setWizardStep(1);
        setWizardCharges([{ reason: '', amount: '' }]);
        setWizardSelection({ class: '', section: '', searchTerm: '' });
        setSelectedStudentIds([]);
        setShowAddAmountModal(true);
    };

    // Receipt Modal State
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    useEffect(() => {
        fetchStudents();
        fetchActivationStatus();
        fetchInstituteProfile();
    }, [selectedMonth, selectedYear, activeTab]);

    const fetchInstituteProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstituteData(response.data.profile);
        } catch (error) {
            console.error('Error fetching institute profile:', error);
        }
    };

    const openReceipt = (student, payment) => {
        console.log("DEBUG: Opening Receipt for Payment Data:", payment);
        const breakage = [
            { label: 'Monthly Tuition Fee', amount: student.monthly_fees },
            ...(student.transport_facility ? [{ label: 'Transport Fee', amount: student.transport_fees }] : []),
            ...(student.extra_charges || []).map(ec => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
        ];

        setReceiptData({
            institute: instituteData,
            student: student,
            payment: { ...payment, month: selectedMonth, year: selectedYear },
            breakage: breakage,
            type: 'MONTHLY'
        });
        setShowReceipt(true);
    };

    const handleDownloadReceipt = async (student, payment) => {
        const breakage = [
            { label: 'Monthly Tuition Fee', amount: student.monthly_fees },
            ...(student.transport_facility ? [{ label: 'Transport Fee', amount: student.transport_fees }] : []),
            ...(student.extra_charges || []).map(ec => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
        ];

        try {
            toast.info("Generating PDF receipt...");
            await downloadReceiptPDF({
                institute: instituteData,
                student: student,
                payment: { ...payment, month: selectedMonth, year: selectedYear },
                breakage: breakage,
                type: 'MONTHLY',
                months: months
            });
            toast.success("Receipt downloaded successfully!");
        } catch (error) {
            console.error("PDF Download Error:", error);
            toast.error(`Download failed: ${error.message || 'Unknown error'}`);
        }
    };

    const fetchActivationStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/monthly-fees-activation`, {
                params: { month: selectedMonth, year: selectedYear },
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsActivated(response.data.activated);
        } catch (error) {
            console.error('Error fetching activation status:', error);
        }
    };

    const toggleActivation = async () => {
        setProcessing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/toggle-monthly-fees`, {
                month: selectedMonth,
                year: selectedYear,
                activate: !isActivated
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setIsActivated(!isActivated);
            toast.success(response.data.message);
        } catch (error) {
            toast.error('Failed to update activation status');
        } finally {
            setProcessing(false);
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/fees-status`, {
                params: { month: selectedMonth, year: selectedYear },
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudents(Array.isArray(response.data.students) ? response.data.students : []);
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---
    const handlePrevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(prev => prev - 1); }
        else { setSelectedMonth(prev => prev - 1); }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(prev => prev + 1); }
        else { setSelectedMonth(prev => prev + 1); }
    };

    const handleCollectClick = (student) => {
        setSelectedStudent(student);
        setShowConfirmModal(true);
    };

    const confirmCollection = async () => {
        if (!selectedStudent) return;
        setProcessing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/collect-fee/${selectedStudent.id}`, {
                month: selectedMonth,
                year: selectedYear
            }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success(`Fee collected for ${selectedStudent.name}`);
            setShowConfirmModal(false);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to collect fee');
        } finally {
            setProcessing(false);
        }
    };

    const handleExtraChargeSubmit = async () => {
        const validCharges = wizardCharges.filter(c => c.reason && c.amount);
        if (validCharges.length === 0) {
            toast.error('At least one reason and amount is required');
            return;
        }
        if (selectedStudentIds.length === 0) {
            toast.error('Please select at least one student');
            return;
        }

        setProcessing(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/add-extra-charge`, {
                charges: validCharges,
                month: selectedMonth,
                year: selectedYear,
                studentIds: selectedStudentIds
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            toast.success('Extra charges added successfully');
            setShowAddAmountModal(false);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to add extra charges');
        } finally {
            setProcessing(false);
        }
    };

    const addChargeRow = () => setWizardCharges([...wizardCharges, { reason: '', amount: '' }]);
    const removeChargeRow = (idx) => setWizardCharges(wizardCharges.filter((_, i) => i !== idx));
    const updateChargeRow = (idx, field, value) => {
        const newCharges = [...wizardCharges];
        newCharges[idx][field] = value;
        setWizardCharges(newCharges);
    };

    const toggleStudentSelection = (id) => {
        if (selectedStudentIds.includes(id)) setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
        else setSelectedStudentIds([...selectedStudentIds, id]);
    };

    const selectAllFiltered = () => {
        const ids = wizardFilteredStudents.map(s => s.id);
        setSelectedStudentIds([...new Set([...selectedStudentIds, ...ids])]);
    };

    const clearFilteredSelection = () => {
        const idsToKeep = selectedStudentIds.filter(id => !wizardFilteredStudents.some(s => s.id === id));
        setSelectedStudentIds(idsToKeep);
    };

    // --- Filters ---
    const filteredStudentsMonthly = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.roll_no || '').toString().includes(searchTerm);
            const matchesClass = filters.class === '' || (s.class || '').toLowerCase().includes(filters.class.toLowerCase());
            const matchesSection = filters.section === '' || (s.section || '').toLowerCase().includes(filters.section.toLowerCase());
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [students, searchTerm, filters]);

    return (
        <React.Fragment>
            {/* --- Top Header Row: Back + Title (Left) | Month Switcher (Right) --- */}
            <header className="fees-top-header-row animate-fade-in">
                <div className="header-left-group">
                    <button className="fees-back-btn-minimal" onClick={() => navigate('/dashboard')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    </button>
                    <h1 className="fees-page-title">Fees Management</h1>
                </div>
                
                <div className="header-right-group">
                    {activeTab === 'monthly' && (
                        <React.Fragment>
                            <button className="add-amt-btn-header" onClick={openAddAmountModal}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Add Amt
                            </button>
                            <div className="activation-toggle-wrap">
                                <span className="activation-label">{isActivated ? 'Activated' : 'Deactivated'}</span>
                                <button 
                                    className={`activation-toggle-btn ${isActivated ? 'active' : ''}`}
                                    onClick={toggleActivation}
                                    disabled={processing}
                                    title={isActivated ? 'Deactivate Monthly Fee Flashcard' : 'Activate Monthly Fee Flashcard'}
                                >
                                    <div className="toggle-thumb"></div>
                                </button>
                            </div>
                        </React.Fragment>
                    )}
                    {activeTab === 'monthly' && (
                        <div className="pro-month-navigator">
                            <button className="nav-arrow-btn" onClick={handlePrevMonth}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
                            <div className="current-month-display">
                                <span className="m-name">{months[selectedMonth - 1]}</span>
                                <span className="m-year">{selectedYear}</span>
                            </div>
                            <button className="nav-arrow-btn" onClick={handleNextMonth}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
                        </div>
                    )}
                </div>
            </header>

            {/* --- Second Row: Tabs --- */}
            <div className="fees-tabs-row">
                <div className="fees-tabs-container">
                    <button className={`fee-tab-btn ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => setActiveTab('monthly')}>Monthly Fees</button>
                    <button className={`fee-tab-btn ${activeTab === 'onetime' ? 'active' : ''}`} onClick={() => setActiveTab('onetime')}>One Time Fees</button>
                </div>
            </div>

            {activeTab === 'monthly' ? (
                <div className="monthly-fees-section">
                    <div className="monthly-combined-container">
                        <div className="monthly-search-filter-bar-container">
                            <div className="search-wrap-monthly">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                <input type="text" placeholder="Search student..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                            <input type="text" placeholder="Class" className="mini-input-monthly" value={filters.class} onChange={(e) => setFilters({...filters, class: e.target.value})} />
                            <input type="text" placeholder="Sec" className="mini-input-monthly" value={filters.section} onChange={(e) => setFilters({...filters, section: e.target.value})} />
                            
                            <div className="monthly-stats-summary">
                                <div className="stat-pill expected">
                                    <span>Expected</span>
                                    <strong>₹{filteredStudentsMonthly.reduce((sum, s) => {
                                        const extra = (s.extra_charges || []).reduce((acc, ec) => acc + parseFloat(ec.amount || 0), 0);
                                        return sum + (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0) + extra);
                                    }, 0).toLocaleString()}</strong>
                                </div>
                                <div className="stat-pill collected">
                                    <span>Collected</span>
                                    <strong>₹{filteredStudentsMonthly.filter(s => s.fee_status === 'paid').reduce((sum, s) => {
                                        const extra = (s.extra_charges || []).reduce((acc, ec) => acc + parseFloat(ec.amount || 0), 0);
                                        return sum + (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0) + extra);
                                    }, 0).toLocaleString()}</strong>
                                </div>
                                <div className="stat-pill left">
                                    <span>Remaining</span>
                                    <strong>₹{filteredStudentsMonthly.filter(s => s.fee_status !== 'paid').reduce((sum, s) => {
                                        const extra = (s.extra_charges || []).reduce((acc, ec) => acc + parseFloat(ec.amount || 0), 0);
                                        return sum + (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0) + extra);
                                    }, 0).toLocaleString()}</strong>
                                </div>
                            </div>
                        </div>
                        
                        <div className="monthly-list-container">
                                {/* Header Row for Table */}
                                <div className="monthly-list-header">
                                <div className="col-student">Student</div>
                                <div className="col-class-sec">Class-Sec</div>
                                <div className="col-roll">Roll No</div>
                                <div className="col-breakdown">Breakdown</div>
                                <div className="col-total text-right">Total</div>
                                <div className="col-action text-center">Action</div>
                                </div>

                                <div className="monthly-list-body">
                                {filteredStudentsMonthly.map(s => {
                                    const monthly = parseFloat(s.monthly_fees || 0);
                                    const transport = s.transport_facility ? parseFloat(s.transport_fees || 0) : 0;
                                    const isPaid = s.fee_status === 'paid';
                                    return (
                                        <div key={s.id} className={`monthly-student-row ${isPaid ? 'row-paid' : ''}`}>
                                            <div className="col-student">
                                                <div className="s-profile-info"><img src={s.photo_url || 'https://via.placeholder.com/40'} alt="" /><div><p>{s.name}</p></div></div>
                                            </div>
                                            <div className="col-class-sec">
                                                <p>{s.class}-{s.section}</p>
                                            </div>
                                            <div className="col-roll">
                                                <span>{s.roll_no}</span>
                                            </div>
                                            <div className="col-breakdown">
                                                <div className="breakdown-list">
                                                    <span>Monthly: ₹{monthly}</span>
                                                    {s.transport_facility && <span>Transport: ₹{transport}</span>}
                                                    {(s.extra_charges || []).map((ec, idx) => (
                                                        <span key={idx}>{ec.reason}: ₹{parseFloat(ec.amount).toLocaleString()}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="col-total text-right"><strong>₹{(monthly + transport + (s.extra_charges || []).reduce((acc, ec) => acc + parseFloat(ec.amount), 0)).toLocaleString()}</strong></div>
                                            <div className="col-action text-center">
                                                {isPaid ? (
                                                    <div className="paid-action-row">
                                                        <span className="paid-tag">✔ PAID</span>
                                                        <div className="receipt-btn-group">
                                                            <button className="view-receipt-btn" onClick={() => openReceipt(s, s)} title="View Receipt">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                            </button>
                                                            <button className="download-receipt-btn" onClick={() => handleDownloadReceipt(s, s)} title="Download Receipt">
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button className="collect-btn" onClick={() => handleCollectClick(s)}>Collect</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                        </div>
                    </div>
                </div>
            ) : (
                <OneTimeFees />
            )}

            {showReceipt && receiptData && (
                <FeeReceiptModal 
                    isOpen={showReceipt} 
                    onClose={() => setShowReceipt(false)} 
                    data={receiptData} 
                />
            )}

            {showConfirmModal && selectedStudent && (
                <div className="fee-modal-overlay" onClick={() => setShowConfirmModal(false)}>
                    <div className="fee-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="fee-modal-header"><h3>Confirm Payment</h3><button onClick={() => setShowConfirmModal(false)}>×</button></div>
                        <div className="fee-modal-body">
                            <p>Collect <strong>₹{(parseFloat(selectedStudent.monthly_fees || 0) + 
                                (selectedStudent.transport_facility ? parseFloat(selectedStudent.transport_fees || 0) : 0) + 
                                (selectedStudent.extra_charges || []).reduce((acc, ec) => acc + parseFloat(ec.amount), 0)).toLocaleString()}</strong> from <strong>{selectedStudent.name}</strong> for <strong>{months[selectedMonth-1]} {selectedYear}</strong>?</p>
                        </div>
                        <div className="fee-modal-footer"><button className="cancel-btn" onClick={() => setShowConfirmModal(false)}>Cancel</button><button className="confirm-btn" onClick={confirmCollection} disabled={processing}>{processing ? 'Processing...' : 'Confirm Payment'}</button></div>
                    </div>
                </div>
            )}

            {showAddAmountModal && (
                <div className="fee-modal-overlay" onClick={() => setShowAddAmountModal(false)}>
                    <div className="fee-modal-card wizard-modal" onClick={e => e.stopPropagation()}>
                        <div className="fee-modal-header">
                            <h3>{wizardStep === 1 ? 'Step 1: Charges' : 'Step 2: Selection'} ({months[selectedMonth - 1]})</h3>
                            <button onClick={() => setShowAddAmountModal(false)}>×</button>
                        </div>
                        
                        <div className="fee-modal-body-wizard">
                            {wizardStep === 1 ? (
                                <div className="wizard-step-1">
                                    <p className="modal-subtitle">Add multiple reasons and their amounts:</p>
                                    <div className="charges-builder-list">
                                        {wizardCharges.map((charge, idx) => (
                                            <div key={idx} className="charge-builder-row">
                                                <input type="text" placeholder="Reason (e.g. Exam Fee)" value={charge.reason} onChange={(e) => updateChargeRow(idx, 'reason', e.target.value)} />
                                                <div className="amount-input-wrap">
                                                    <span>₹</span>
                                                    <input type="number" placeholder="0" value={charge.amount} onChange={(e) => updateChargeRow(idx, 'amount', e.target.value)} />
                                                </div>
                                                {wizardCharges.length > 1 && (
                                                    <button className="remove-charge-row-btn" onClick={() => removeChargeRow(idx)}>×</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button className="add-row-wizard-btn" onClick={addChargeRow}>+ Add Another Row</button>
                                    <div className="wizard-summary-bar">
                                        <span>Total Extra:</span>
                                        <strong>₹{wizardCharges.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0).toLocaleString()}</strong>
                                    </div>
                                </div>
                            ) : (
                                <div className="wizard-step-2">
                                    <div className="selection-filters-bar">
                                        <input type="text" placeholder="Search..." className="wizard-mini-input" value={wizardSelection.searchTerm} onChange={(e) => setWizardSelection({...wizardSelection, searchTerm: e.target.value})} />
                                        <input type="text" placeholder="Class" className="wizard-mini-input" value={wizardSelection.class} onChange={(e) => setWizardSelection({...wizardSelection, class: e.target.value})} />
                                        <input type="text" placeholder="Sec" className="wizard-mini-input" value={wizardSelection.section} onChange={(e) => setWizardSelection({...wizardSelection, section: e.target.value})} />
                                    </div>
                                    
                                    <div className="selection-actions">
                                        <button onClick={selectAllFiltered}>Select All Visible</button>
                                        <button onClick={clearFilteredSelection}>Clear Visible</button>
                                        <span className="selected-count-badge">{selectedStudentIds.length} Selected</span>
                                    </div>

                                    <div className="student-selection-grid">
                                        {wizardFilteredStudents.map(s => (
                                            <div key={s.id} className={`student-select-card ${selectedStudentIds.includes(s.id) ? 'selected' : ''}`} onClick={() => toggleStudentSelection(s.id)}>
                                                <img src={s.photo_url || 'https://via.placeholder.com/30'} alt="" />
                                                <div className="s-mini-info">
                                                    <p>{s.name}</p>
                                                    <span>{s.class}-{s.section} | R: {s.roll_no}</span>
                                                </div>
                                                <div className="select-indicator">{selectedStudentIds.includes(s.id) ? '✔' : ''}</div>
                                            </div>
                                        ))}
                                        {wizardFilteredStudents.length === 0 && <p className="no-data-msg">No students found</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="fee-modal-footer">
                            {wizardStep === 1 ? (
                                <button className="confirm-btn" onClick={() => setWizardStep(2)}>Next: Select Students</button>
                            ) : (
                                <React.Fragment>
                                    <button className="cancel-btn" onClick={() => setWizardStep(1)}>Back</button>
                                    <button className="confirm-btn" onClick={handleExtraChargeSubmit} disabled={processing}>{processing ? 'Processing...' : 'Confirm & Add Charges'}</button>
                                </React.Fragment>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Fees;