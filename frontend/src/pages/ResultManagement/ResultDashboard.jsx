import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_ENDPOINTS } from '../../config';
import { useTheme } from '../../context/ThemeContext';
import './ResultDashboard.css';

const ResultDashboard = () => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState(1); // Step 1: Info, Step 2: Blueprint
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState({});

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        class_name: '',
        section: '',
        show_highest_marks: false,
        include_grade: true, // Defaulting to true as per most use cases, can be toggled
        include_percentage: true
    });

    const [subjects, setSubjects] = useState([
        { name: 'English', max_theory: 100, passing_marks: 33 },
        { name: 'Mathematics', max_theory: 100, passing_marks: 33 },
    ]);

    // Initial standard grading rules
    const [gradingRules, setGradingRules] = useState([
        { grade: 'A+', min: 90, max: 100 },
        { grade: 'A', min: 80, max: 90 },
        { grade: 'B', min: 70, max: 80 },
        { grade: 'C', min: 60, max: 70 },
        { grade: 'D', min: 40, max: 60 },
        { grade: 'F', min: 0, max: 40 }
    ]);

    const navigate = useNavigate();

    useEffect(() => {
        fetchExams();
        fetchClassSections();
    }, []);

    useEffect(() => {
        if (showModal) {
            document.body.classList.add('hide-dashboard-header');
        } else {
            document.body.classList.remove('hide-dashboard-header');
        }
        return () => document.body.classList.remove('hide-dashboard-header');
    }, [showModal]);

    const fetchExams = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/api/exam/list', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExams(response.data);
        } catch (error) {
            console.error('Error fetching exams', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteExam = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this Marksheet? All data will be lost.")) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/api/exam/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Marksheet deleted");
            fetchExams();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete");
        }
    }

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
                    if (!sectionMap[cls]) sectionMap[cls] = new Set();
                    sectionMap[cls].add(sec);
                }
            });

            const sortedClasses = Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            // Convert Sets to Arrays for render
            const finalSections = {};
            sortedClasses.forEach(c => {
                finalSections[c] = Array.from(sectionMap[c]).sort();
            });

            setClasses(sortedClasses);
            setSections(finalSections);
        } catch (error) {
            console.error('Error fetching classes', error);
        }
    };


    const handleNextStep = () => {
        if (!formData.name || !formData.class_name || !formData.section) {
            toast.error('Please fill all required fields');
            return;
        }
        setStep(2);
    };

    const handleAddSubject = () => {
        const firstSub = subjects[0];
        setSubjects([...subjects, {
            name: '',
            max_theory: firstSub ? firstSub.max_theory : 0,
            passing_marks: firstSub ? firstSub.passing_marks : 0
        }]);
    };

    const handleSubjectChange = (index, field, value) => {
        const updated = [...subjects];
        updated[index][field] = value;
        setSubjects(updated);
    };

    const handleRemoveSubject = (index) => {
        const updated = subjects.filter((_, i) => i !== index);
        setSubjects(updated);
    };

    const handleRuleChange = (index, field, value) => {
        const updated = [...gradingRules];
        updated[index][field] = value;
        setGradingRules(updated);
    };

    const handleCreateExam = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');

            const formattedSubjects = subjects.map(s => ({
                name: s.name,
                max_theory: parseInt(s.max_theory) || 0,
                max_practical: 0,
                passing_marks: parseInt(s.passing_marks) || 0
            }));

            const payload = {
                ...formData,
                subjects_blueprint: formattedSubjects,
                grading_rules: formData.include_grade ? gradingRules : [],
                manual_stats: {}
            };

            await axios.post('http://localhost:5000/api/exam/create', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Marksheet Created Successfully!');

            setShowModal(false);
            setStep(1);
            setFormData({ name: '', class_name: '', section: '', show_highest_marks: false, include_grade: true, include_percentage: true });
            fetchExams();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create marksheet');
        }
    };

    const { theme } = useTheme();

    return (
        <div className={`result-dashboard theme-${theme}`}>
            <div className="rd-header">
                <h2>Result Management</h2>
                <button
                    className="btn-create-exam"
                    onClick={() => { setShowModal(true); setStep(1); }}
                >
                    + Create Marksheet Blueprint
                </button>
            </div>

            {loading ? (
                <div className="loading-spinner">Loading Exams...</div>
            ) : (
                <div className="exams-grid">
                    {exams.length === 0 ? (
                        <div className="no-exams">
                            <p>No Marksheets created yet.</p>
                            <p>Click "Create Marksheet Blueprint" to start.</p>
                        </div>
                    ) : (
                        exams.map(exam => (
                            <div key={exam.id} className="exam-card" onClick={() => navigate(`/dashboard/results/${exam.id}`)}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div className="exam-card-icon">📄</div>
                                    <div className="card-top-actions">
                                        <button
                                            onClick={(e) => deleteExam(e, exam.id)}
                                            className="btn-delete-card"
                                            title="Delete Marksheet"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="exam-card-info">
                                    <h3>{exam.name}</h3>
                                    <p>Class {exam.class_name} - {exam.section}</p>
                                    <span className="exam-date">{new Date(exam.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="exam-card-actions">
                                    <button className="btn-view">Fill Marks</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Wizard Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '800px', width: '95%', padding: '32px' }}>
                        <button className="close-btn" onClick={() => setShowModal(false)}>×</button>

                        <h3 className="modal-title-text">
                            {step === 1 ? 'Step 1: Marksheet Details' : 'Step 2: Structure & Grading'}
                        </h3>

                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '0', marginTop: '10px' }}>
                            {step === 1 ? (
                                <div className="step-1-form">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label>Exam / Report Card Name <span style={{ color: '#ef4444' }}>*</span></label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Final Term Examination 2026"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                required
                                                className="form-input"
                                            />
                                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>This will appear as the main title on the report card.</p>
                                        </div>
                                        <div className="form-group">
                                            <label>Target Class <span style={{ color: '#ef4444' }}>*</span></label>
                                            <select
                                                value={formData.class_name}
                                                onChange={e => setFormData({ ...formData, class_name: e.target.value, section: '' })}
                                                required
                                                className="form-input"
                                            >
                                                <option value="">Select Class</option>
                                                {classes.map(c => (
                                                    <option key={c} value={c}>Class {c}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Section <span style={{ color: '#ef4444' }}>*</span></label>
                                            <select
                                                value={formData.section}
                                                onChange={e => setFormData({ ...formData, section: e.target.value })}
                                                required
                                                className="form-input"
                                                disabled={!formData.class_name}
                                            >
                                                <option value="">Select Section</option>
                                                {formData.class_name && sections[formData.class_name]?.map(s => (
                                                    <option key={s} value={s}>Section {s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="step-2-blueprint">
                                    {/* Config Toggles - Moved to top for visibility */}
                                    <div className="blueprint-section">
                                        <h4 style={{ color: '#1e293b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            ✨ Report Card Features
                                        </h4>
                                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', padding: '18px', borderRadius: '16px', border: '1.5px solid #dbeafe' }}>
                                            <label className="feature-toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.show_highest_marks}
                                                    onChange={e => setFormData({ ...formData, show_highest_marks: e.target.checked })}
                                                />
                                                <span>Topper Marks</span>
                                            </label>
                                            <label className="feature-toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.include_percentage}
                                                    onChange={e => setFormData({ ...formData, include_percentage: e.target.checked })}
                                                />
                                                <span>Percentage (%)</span>
                                            </label>
                                            <label className="feature-toggle-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.include_grade}
                                                    onChange={e => setFormData({ ...formData, include_grade: e.target.checked })}
                                                />
                                                <span>Grading (A,B,C)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Subjects Section */}
                                    <div className="blueprint-section">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, color: '#1e293b' }}>Subjects Blueprint</h4>
                                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Define subjects and their marking criteria.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddSubject}
                                                className="btn-add-subject"
                                            >
                                                + Add Subject
                                            </button>
                                        </div>

                                        <div className="blueprint-table-container">
                                            <table className="blueprint-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: 'left' }}>Subject Name</th>
                                                        <th style={{ textAlign: 'center' }}>Max Marks</th>
                                                        <th style={{ textAlign: 'center' }}>Passing</th>
                                                        <th style={{ width: '40px' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {subjects.map((sub, idx) => (
                                                        <tr key={idx} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={sub.name}
                                                                    onChange={e => handleSubjectChange(idx, 'name', e.target.value)}
                                                                    placeholder="e.g. Physics"
                                                                    className="form-input"
                                                                    style={{ padding: '8px', fontSize: '14px' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={sub.max_theory}
                                                                    onChange={e => handleSubjectChange(idx, 'max_theory', e.target.value)}
                                                                    className="form-input"
                                                                    style={{ padding: '8px', fontSize: '14px', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="number"
                                                                    value={sub.passing_marks}
                                                                    onChange={e => handleSubjectChange(idx, 'passing_marks', e.target.value)}
                                                                    className="form-input"
                                                                    style={{ padding: '8px', fontSize: '14px', textAlign: 'center' }}
                                                                />
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <button
                                                                    onClick={() => handleRemoveSubject(idx)}
                                                                    style={{ color: '#ef4444', background: '#fff1f2', border: 'none', width: '28px', height: '28px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Grading Rules (Conditional) */}
                                    {formData.include_grade && (
                                        <div className="blueprint-section">
                                            <h4 style={{ color: '#1e293b', marginBottom: '12px' }}>Grading Matrix</h4>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px' }}>
                                                {gradingRules.map((rule, idx) => (
                                                    <div key={idx} className="grading-card">
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <label>Grade</label>
                                                            <input
                                                                type="text"
                                                                value={rule.grade}
                                                                onChange={e => handleRuleChange(idx, 'grade', e.target.value)}
                                                                style={{ width: '45px', padding: '4px' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <input
                                                                type="number"
                                                                value={rule.min}
                                                                onChange={e => handleRuleChange(idx, 'min', e.target.value)}
                                                                style={{ width: '100%' }}
                                                            />
                                                            <span style={{ fontSize: '10px', opacity: 0.8 }}>to</span>
                                                            <input
                                                                type="number"
                                                                value={rule.max}
                                                                onChange={e => handleRuleChange(idx, 'max', e.target.value)}
                                                                style={{ width: '100%' }}
                                                            />
                                                        </div>
                                                        <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '5px', opacity: 0.7 }}>Percentage Range</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            {step === 2 && (
                                <button type="button" className="btn-cancel" onClick={() => setStep(1)} style={{ marginRight: 'auto' }}>
                                    ← Previous Step
                                </button>
                            )}

                            <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>

                            {step === 1 ? (
                                <button type="button" className="btn-save" onClick={handleNextStep}>
                                    Configure Blueprint →
                                </button>
                            ) : (
                                <button type="button" className="btn-save" onClick={handleCreateExam}>
                                    ✨ Create Marksheet Now
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultDashboard;
