import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../config';
import { useTheme } from '../context/ThemeContext';
import './Routine.css';

const Routine = () => {
    const { theme: globalTheme, toggleTheme } = useTheme();
    const isDarkMode = globalTheme === 'dark';

    const rawData = localStorage.getItem('userData');
    const userData = rawData ? JSON.parse(rawData) : null;
    const userType = localStorage.getItem('userType');

    if (!userData) return <div style={{ padding: '20px', textAlign: 'center' }}>Resolving profile...</div>;

    const instituteId = userType === 'principal' ? userData.id : (userData.institute_id || userData.id);

    const [overview, setOverview] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filterValues, setFilterValues] = useState({ class: '', section: '' });
    const [classes, setClasses] = useState([]);
    const [rawStudents, setRawStudents] = useState([]);
    const [sections, setSections] = useState([]);
    const [teachers, setTeachers] = useState([]);

    // Modal & Builder State
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [builderStep, setBuilderStep] = useState(1);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    // Step 1: Target
    const [target, setTarget] = useState({ class: '', section: '' });
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);

    // Step 2: Config
    const [config, setConfig] = useState({
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        slots: [
            { id: Date.now(), label: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'period' }
        ]
    });

    // Step 3: Data
    const [routineData, setRoutineData] = useState({});

    // UI Interaction
    const [activeSlot, setActiveSlot] = useState(null);
    const [tempSlot, setTempSlot] = useState({ subject: '', teacherId: '' });

    const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const themeColors = {
        light: {
            bg: '#f8fafc',
            cardBg: '#ffffff',
            text: '#0f172a',
            textSecondary: '#64748b',
            border: '#e2e8f0',
            inputBg: '#ffffff',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            buttonBg: '#4f46e5',
            buttonHover: '#4338ca',
            accent: '#6366f1'
        },
        dark: {
            bg: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
            cardBg: '#2d3748',
            text: '#f7fafc',
            textSecondary: '#cbd5e0',
            border: '#4a5568',
            inputBg: '#1a202c',
            shadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            buttonBg: '#667eea',
            buttonHover: '#5a67d8',
            accent: '#9f7aea'
        }
    };

    const currentTheme = isDarkMode ? themeColors.dark : themeColors.light;

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!instituteId) {
                console.error("Missing instituteId for fetching routine routine data");
                return;
            }

            // 1. Fetch Overview
            const overviewRes = await axios.get(`${API_ENDPOINTS.ROUTINE}/overview/${instituteId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOverview(overviewRes.data || []);

            // 2. Fetch Students/Classes
            const studentsRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allStudents = studentsRes.data.students || [];
            setRawStudents(allStudents);
            const uniqueClasses = [...new Set(allStudents.map(s => String(s.class).trim()))]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            setClasses(uniqueClasses);

            // 3. Fetch Teachers
            const teachersRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/teacher/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeachers(teachersRes.data.teachers || []);

            setIsDataLoaded(true);
        } catch (error) {
            console.error('Routine Data Fetch Error:', error);
            toast.error('Failed to load routine dashboard data');
            setIsDataLoaded(true);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredOverview = useMemo(() => {
        return overview.filter(r => {
            const matchesClass = !filterValues.class || String(r.class_name) === String(filterValues.class);
            const matchesSection = !filterValues.section || r.section.toLowerCase().includes(filterValues.section.toLowerCase());
            return matchesClass && matchesSection;
        });
    }, [overview, filterValues]);

    const handleTargetChange = (field, value) => {
        const newTarget = { ...target, [field]: value };
        setTarget(newTarget);

        if (field === 'class') {
            const classSections = [...new Set(rawStudents.filter(s => String(s.class).trim() === value).map(s => String(s.section).trim()))]
                .filter(Boolean)
                .sort();
            setSections(classSections);
            setTarget({ ...newTarget, section: '' });
        }
    };

    const startBuilder = () => {
        setTarget({ class: '', section: '' });
        setConfig({
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            slots: [{ id: Date.now(), label: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'period' }]
        });
        setRoutineData({});
        setIsEditMode(false);
        setIsViewOnly(false);
        setBuilderStep(1);
        setIsBuilderOpen(true);
    };

    const handleViewRoutine = async (r) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_ENDPOINTS.ROUTINE}/${instituteId}/${r.class_name}/${r.section}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                setTarget({ class: r.class_name, section: r.section });
                setConfig(res.data.config);
                setRoutineData(res.data.data);
                setIsEditMode(true);
                setIsViewOnly(true);
                setBuilderStep(3); // Go straight to the grid for viewing
                setIsBuilderOpen(true);
            }
        } catch (error) {
            toast.error('Failed to load routine details');
        }
    };

    const handleDeleteRoutine = async (r, e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete routine for Class ${r.class_name}-${r.section}?`)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.ROUTINE}/${instituteId}/${r.class_name}/${r.section}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Routine deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete routine');
        }
    };

    const addSlot = () => {
        setConfig({
            ...config,
            slots: [...config.slots, { id: Date.now(), label: `Period ${config.slots.length + 1}`, startTime: '', endTime: '', type: 'period' }]
        });
    };

    const removeSlot = (id) => {
        setConfig({ ...config, slots: config.slots.filter(s => s.id !== id) });
    };

    const handleSaveRoutine = async (publish = false) => {
        if (!target.class || !target.section) {
            toast.warning('Please select class and section');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.ROUTINE}/save`, {
                instituteId,
                className: target.class,
                section: target.section,
                config,
                data: routineData,
                isPublished: publish
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success(`Routine ${publish ? 'published' : 'saved'} successfully!`);
            setIsBuilderOpen(false);
            fetchData();
        } catch (error) {
            toast.error('Failed to save routine');
        }
    };

    if (!isDataLoaded) {
        return (
            <div style={{ minHeight: '100vh', background: currentTheme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}>
            <div>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '40px',
                    flexWrap: 'wrap',
                    gap: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 style={{
                            color: currentTheme.text,
                            fontSize: '32px',
                            fontWeight: '800',
                            margin: 0,
                            letterSpacing: '-1px'
                        }}>
                            📚 Routine Manager
                        </h1>
                        <button 
                            className={`btn-filter-toggle ${showFilters ? 'active' : ''}`}
                            onClick={() => setShowFilters(!showFilters)}
                            style={{
                                background: showFilters ? '#3b82f6' : (isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9'),
                                color: showFilters ? 'white' : (isDarkMode ? '#94a3b8' : '#64748b'),
                                border: 'none',
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            title="Filter Routines"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {(userType === 'principal' || userType === 'teacher' || userData.special_permission) && (
                            <button
                                onClick={startBuilder}
                                className="btn-create-routine"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Create New Routine
                            </button>
                        )}
                    </div>
                </div>

                {showFilters && (
                    <div className="rd-filter-bar animate-slide-down" style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '20px',
                        marginBottom: '30px',
                        background: isDarkMode ? '#1e293b' : 'white',
                        padding: '20px',
                        borderRadius: '16px',
                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div className="filter-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Class</label>
                            <select 
                                value={filterValues.class}
                                onChange={(e) => setFilterValues({...filterValues, class: e.target.value})}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                    background: isDarkMode ? '#0f172a' : 'white',
                                    color: isDarkMode ? 'white' : '#1e293b',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                            </select>
                        </div>
                        <div className="filter-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Section</label>
                            <input 
                                type="text" 
                                placeholder="e.g. A" 
                                value={filterValues.section}
                                onChange={(e) => setFilterValues({...filterValues, section: e.target.value})}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                                    background: isDarkMode ? '#0f172a' : 'white',
                                    color: isDarkMode ? 'white' : '#1e293b',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            />
                        </div>
                        <button 
                            className="btn-clear-filters" 
                            onClick={() => setFilterValues({class: '', section: ''})}
                            style={{
                                padding: '10px 20px',
                                background: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
                                color: '#64748b',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontSize: '14px',
                                height: '42px'
                            }}
                        >
                            Clear
                        </button>
                    </div>
                )}

                {/* Builder Modal (Create/Edit/View) */}
                {isBuilderOpen && (
                    <div style={{
                        background: currentTheme.cardBg,
                        borderRadius: '20px',
                        padding: '40px',
                        marginBottom: '40px',
                        boxShadow: currentTheme.shadow,
                        border: `1px solid ${currentTheme.border}`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                            <h2 style={{ color: currentTheme.text, margin: 0, fontSize: '28px', fontWeight: '700' }}>
                                {isEditMode ? (isViewOnly ? '📖 View Routine' : '✏️ Edit Routine') : '➕ Create New Routine'}
                                {isViewOnly && (
                                    <span style={{ fontSize: '16px', fontWeight: '400', marginLeft: '15px', color: currentTheme.textSecondary }}>
                                        {target.class} - {target.section}
                                    </span>
                                )}
                            </h2>
                            <button
                                onClick={() => setIsBuilderOpen(false)}
                                style={{
                                    background: 'transparent',
                                    color: currentTheme.text,
                                    border: 'none',
                                    fontSize: '28px',
                                    cursor: 'pointer',
                                    padding: '5px'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Stepper info */}
                        {!isViewOnly && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                                {[1, 2, 3].map(step => (
                                    <div key={step} style={{
                                        padding: '10px 20px',
                                        borderRadius: '10px',
                                        background: builderStep === step ? currentTheme.accent : currentTheme.inputBg,
                                        color: builderStep === step ? 'white' : currentTheme.textSecondary,
                                        fontWeight: '600',
                                        fontSize: '14px',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        Step {step}: {step === 1 ? 'Target' : step === 2 ? 'Time Slots' : 'Schedule'}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Step content */}
                        <div style={{ marginBottom: '30px' }}>
                            {builderStep === 1 && (
                                <div className="fadeIn">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                                        <div>
                                            <label style={{ color: currentTheme.text, display: 'block', marginBottom: '8px', fontWeight: '600' }}>Select Class</label>
                                            <select
                                                value={target.class}
                                                onChange={(e) => handleTargetChange('class', e.target.value)}
                                                disabled={isViewOnly}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: '10px',
                                                    border: `2px solid ${currentTheme.border}`,
                                                    background: currentTheme.inputBg,
                                                    color: currentTheme.text,
                                                    fontSize: '15px'
                                                }}
                                            >
                                                <option value="">Choose class...</option>
                                                {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ color: currentTheme.text, display: 'block', marginBottom: '8px', fontWeight: '600' }}>Select Section</label>
                                            <select
                                                value={target.section}
                                                onChange={(e) => handleTargetChange('section', e.target.value)}
                                                disabled={!target.class || isViewOnly}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    borderRadius: '10px',
                                                    border: `2px solid ${currentTheme.border}`,
                                                    background: currentTheme.inputBg,
                                                    color: currentTheme.text,
                                                    fontSize: '15px'
                                                }}
                                            >
                                                <option value="">Choose section...</option>
                                                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <label style={{ color: currentTheme.text, display: 'block', marginBottom: '12px', fontWeight: '600', fontSize: '16px' }}>Active Days *</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                        {availableDays.map(day => (
                                            <button
                                                key={day}
                                                onClick={() => !isViewOnly && setConfig({
                                                    ...config,
                                                    days: config.days.includes(day) ? config.days.filter(d => d !== day) : [...config.days, day]
                                                })}
                                                style={{
                                                    padding: '10px 20px',
                                                    borderRadius: '10px',
                                                    border: `2px solid ${config.days.includes(day) ? currentTheme.accent : currentTheme.border}`,
                                                    background: config.days.includes(day) ? currentTheme.accent : currentTheme.inputBg,
                                                    color: config.days.includes(day) ? 'white' : currentTheme.text,
                                                    cursor: isViewOnly ? 'default' : 'pointer',
                                                    fontWeight: '600',
                                                    fontSize: '14px',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {builderStep === 2 && (
                                <div className="fadeIn">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {config.slots.map((slot, idx) => (
                                            <div key={slot.id} style={{
                                                background: currentTheme.inputBg,
                                                padding: '20px',
                                                borderRadius: '12px',
                                                border: `1px solid ${currentTheme.border}`,
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 50px',
                                                gap: '15px',
                                                alignItems: 'end'
                                            }}>
                                                <div>
                                                    <label style={{ color: currentTheme.text, display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600' }}>Label</label>
                                                    <input type="text" value={slot.label} onChange={(e) => {
                                                        const newSlots = [...config.slots];
                                                        newSlots[idx].label = e.target.value;
                                                        setConfig({ ...config, slots: newSlots });
                                                    }} disabled={isViewOnly} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, background: currentTheme.cardBg, color: currentTheme.text }} />
                                                </div>
                                                <div>
                                                    <label style={{ color: currentTheme.text, display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600' }}>Start</label>
                                                    <input type="time" value={slot.startTime} onChange={(e) => {
                                                        const newSlots = [...config.slots];
                                                        newSlots[idx].startTime = e.target.value;
                                                        setConfig({ ...config, slots: newSlots });
                                                    }} disabled={isViewOnly} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, background: currentTheme.cardBg, color: currentTheme.text }} />
                                                </div>
                                                <div>
                                                    <label style={{ color: currentTheme.text, display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600' }}>End</label>
                                                    <input type="time" value={slot.endTime} onChange={(e) => {
                                                        const newSlots = [...config.slots];
                                                        newSlots[idx].endTime = e.target.value;
                                                        setConfig({ ...config, slots: newSlots });
                                                    }} disabled={isViewOnly} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, background: currentTheme.cardBg, color: currentTheme.text }} />
                                                </div>
                                                <div>
                                                    <label style={{ color: currentTheme.text, display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: '600' }}>Type</label>
                                                    <select value={slot.type} onChange={(e) => {
                                                        const newSlots = [...config.slots];
                                                        newSlots[idx].type = e.target.value;
                                                        setConfig({ ...config, slots: newSlots });
                                                    }} disabled={isViewOnly} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, background: currentTheme.cardBg, color: currentTheme.text }}>
                                                        <option value="period">Study Period</option>
                                                        <option value="break">Short Break</option>
                                                    </select>
                                                </div>
                                                <button onClick={() => !isViewOnly && removeSlot(slot.id)} style={{ background: '#e53e3e', color: 'white', border: 'none', width: '40px', height: '40px', borderRadius: '8px', cursor: isViewOnly ? 'default' : 'pointer' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    {!isViewOnly && (
                                        <button onClick={addSlot} style={{ background: currentTheme.accent, color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', marginTop: '20px' }}>+ Add Time Slot</button>
                                    )}
                                </div>
                            )}

                            {builderStep === 3 && (
                                <div className="fadeIn">
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ padding: '15px', textAlign: 'left', color: currentTheme.text, fontWeight: '700', fontSize: '14px', background: currentTheme.inputBg, borderRadius: '10px 0 0 10px' }}>Period / Day</th>
                                                    {config.days.map(day => (
                                                        <th key={day} style={{ padding: '15px', textAlign: 'center', color: currentTheme.text, fontWeight: '700', fontSize: '14px', background: currentTheme.inputBg, minWidth: '150px' }}>{day}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config.slots.map((slot, sIdx) => (
                                                    <tr key={slot.id}>
                                                        <td style={{ padding: '15px', background: currentTheme.inputBg, color: currentTheme.text, fontWeight: '600', fontSize: '13px', borderRadius: '10px 0 0 10px' }}>
                                                            <div style={{ fontWeight: '700' }}>{slot.label}</div>
                                                            <div style={{ fontSize: '11px', color: currentTheme.textSecondary, marginTop: '4px' }}>{slot.startTime} - {slot.endTime}</div>
                                                        </td>
                                                        {config.days.map(day => {
                                                            const cellData = routineData[day]?.[sIdx] || { subject: '', teacherId: '' };
                                                            const teacherName = teachers.find(t => String(t.id) === String(cellData.teacherId))?.name;

                                                            if (slot.type === 'break') {
                                                                return (
                                                                    <td key={day} style={{ padding: '10px', textAlign: 'center', background: currentTheme.inputBg, borderLeft: `1px solid ${currentTheme.border}`, opacity: 0.6 }}>
                                                                        <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '2px' }}>BREAK</div>
                                                                    </td>
                                                                );
                                                            }

                                                            return (
                                                                <td key={day} style={{ padding: '10px', textAlign: 'center', background: currentTheme.inputBg, borderLeft: `1px solid ${currentTheme.border}`, cursor: isViewOnly ? 'default' : 'pointer' }}
                                                                    onClick={() => {
                                                                        if (!isViewOnly) {
                                                                            setActiveSlot({ day, index: sIdx });
                                                                            setTempSlot(cellData);
                                                                        }
                                                                    }}>
                                                                    {cellData.subject ? (
                                                                        <div style={{ background: currentTheme.accent, color: 'white', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
                                                                            <div style={{ fontWeight: '700', marginBottom: '4px' }}>{cellData.subject}</div>
                                                                            <div style={{ fontSize: '11px', opacity: 0.9 }}>{teacherName || 'No Teacher'}</div>
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ color: currentTheme.textSecondary, fontSize: '12px', fontStyle: 'italic' }}>{isViewOnly ? '—' : 'Assign'}</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            {builderStep > 1 && !isViewOnly && (
                                <button onClick={() => setBuilderStep(builderStep - 1)} style={{ background: currentTheme.inputBg, color: currentTheme.text, border: `2px solid ${currentTheme.border}`, padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Back</button>
                            )}
                            {builderStep < 3 && !isViewOnly ? (
                                <button onClick={() => setBuilderStep(builderStep + 1)} disabled={builderStep === 1 && (!target.class || !target.section)} style={{ background: currentTheme.buttonBg, color: 'white', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', opacity: (builderStep === 1 && (!target.class || !target.section)) ? 0.5 : 1 }}>Continue</button>
                            ) : (
                                !isViewOnly ? (
                                    <>
                                        <button onClick={() => handleSaveRoutine(false)} style={{ background: currentTheme.inputBg, color: currentTheme.text, border: `2px solid ${currentTheme.border}`, padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Save Draft</button>
                                        <button onClick={() => handleSaveRoutine(true)} style={{ background: currentTheme.buttonBg, color: 'white', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', boxShadow: currentTheme.shadow }}>Publish Routine</button>
                                    </>
                                ) : (
                                    (userType === 'principal' || userType === 'teacher' || userData.special_permission) && (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => setIsViewOnly(false)} style={{ background: currentTheme.accent, color: 'white', border: 'none', padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>✏️ Edit Routine</button>
                                            <button onClick={() => setIsBuilderOpen(false)} style={{ background: currentTheme.inputBg, color: currentTheme.text, border: `2px solid ${currentTheme.border}`, padding: '12px 28px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Close</button>
                                        </div>
                                    )
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Routine Cards Grid */}
                {!isBuilderOpen && (
                    <div style={{ position: 'relative' }}>
                        {overview.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '80px 20px',
                                borderRadius: '20px',
                                border: `2px dashed ${currentTheme.border}`
                            }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📅</div>
                                <h3 style={{ color: currentTheme.text, fontSize: '24px', marginBottom: '10px' }}>No Routines Created</h3>
                                <p style={{ color: currentTheme.textSecondary, fontSize: '16px' }}>Get started by creating your first class routine.</p>
                            </div>
                        ) : filteredOverview.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '80px 20px',
                                borderRadius: '20px',
                                border: `2px dashed ${currentTheme.border}`
                            }}>
                                <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔍</div>
                                <h3 style={{ color: currentTheme.text, fontSize: '24px', marginBottom: '10px' }}>No Match Found</h3>
                                <p style={{ color: currentTheme.textSecondary, fontSize: '16px' }}>Adjust your filters to see routines.</p>
                            </div>
                        ) : (
                            <div className="routine-grid">
                                {filteredOverview.map((r, idx) => (
                                    <div
                                        key={idx}
                                        className="routine-card"
                                        onClick={() => handleViewRoutine(r)}
                                    >
                                        <div className="routine-card-header">
                                            <div className="routine-icon-box">
                                                <span>📚</span>
                                            </div>
                                            
                                            {(userType === 'principal' || userType === 'teacher' || userData.special_permission) && (
                                                <div className="routine-actions">
                                                    <button
                                                        onClick={(e) => handleDeleteRoutine(r, e)}
                                                        className="btn-delete-routine"
                                                        title="Delete Routine"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="routine-info">
                                            <h3>Class {r.class_name}</h3>
                                            <p>Section {r.section}</p>
                                        </div>

                                        <div className={`routine-status-badge ${r.is_published ? 'status-published' : 'status-draft'}`}>
                                            <div className="status-dot"></div>
                                            <span>{r.is_published ? 'Published' : 'Draft'}</span>
                                        </div>

                                        <div className="routine-footer">
                                            <div className="view-btn-arrow">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Slot Assign Modal */}
            {activeSlot && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: currentTheme.cardBg,
                        width: '100%',
                        maxWidth: '450px',
                        padding: '30px',
                        borderRadius: '20px',
                        boxShadow: currentTheme.shadow
                    }}>
                        <h3 style={{ color: currentTheme.text, margin: '0 0 10px 0' }}>Assign Session</h3>
                        <p style={{ color: currentTheme.textSecondary, fontSize: '14px', marginBottom: '25px' }}>
                            Managing {activeSlot.day} - {config.slots[activeSlot.index].label}
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ color: currentTheme.text, display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Subject Name</label>
                            <input
                                type="text"
                                value={tempSlot.subject}
                                onChange={(e) => setTempSlot({ ...tempSlot, subject: e.target.value })}
                                placeholder="e.g. Mathematics"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${currentTheme.border}`,
                                    background: currentTheme.inputBg,
                                    color: currentTheme.text,
                                    boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                        </div>

                        <div style={{ marginBottom: '30px' }}>
                            <label style={{ color: currentTheme.text, display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Assigned Teacher</label>
                            <select
                                value={tempSlot.teacherId}
                                onChange={(e) => setTempSlot({ ...tempSlot, teacherId: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${currentTheme.border}`,
                                    background: currentTheme.inputBg,
                                    color: currentTheme.text
                                }}
                            >
                                <option value="">Select Staff...</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    const newData = { ...routineData };
                                    if (!newData[activeSlot.day]) newData[activeSlot.day] = [];
                                    newData[activeSlot.day][activeSlot.index] = { subject: '', teacherId: '' };
                                    setRoutineData(newData);
                                    setActiveSlot(null);
                                }}
                                style={{ background: '#e53e3e', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                            >
                                Clear Slot
                            </button>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setActiveSlot(null)} style={{ background: 'transparent', color: currentTheme.text, border: 'none', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                                <button
                                    onClick={() => {
                                        if (!tempSlot.subject) { toast.warning('Please enter a subject'); return; }
                                        const newData = { ...routineData };
                                        if (!newData[activeSlot.day]) newData[activeSlot.day] = [];
                                        newData[activeSlot.day][activeSlot.index] = tempSlot;
                                        setRoutineData(newData);
                                        setActiveSlot(null);
                                    }}
                                    style={{ background: currentTheme.buttonBg, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Routine;

