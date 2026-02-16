import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './ResultDashboard.css';

const CreateExam = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        session: new Date().getFullYear().toString(),
        class_name: '',
        section: '',
        show_highest_marks: false
    });

    const [subjects, setSubjects] = useState([
        { name: 'English', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Mathematics', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Science', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Social Science', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Hindi', max_theory: 80, max_practical: 20, passing_marks: 33 }
    ]);

    const handleAddSubject = () => {
        setSubjects([...subjects, { name: '', max_theory: 0, max_practical: 0, passing_marks: 0 }]);
    };

    const handleSubjectChange = (index, field, value) => {
        const updated = [...subjects];
        updated[index][field] = value;
        setSubjects(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...formData,
                subjects_blueprint: subjects,
                grading_rules: [
                    { grade: 'A+', min: 90, max: 100 },
                    { grade: 'A', min: 80, max: 90 },
                    { grade: 'B+', min: 70, max: 80 },
                    { grade: 'B', min: 60, max: 70 },
                    { grade: 'C', min: 50, max: 60 },
                    { grade: 'D', min: 40, max: 50 },
                    { grade: 'F', min: 0, max: 40 }
                ],
                manual_stats: { class_topper_name: '', class_topper_marks: '', section_topper_name: '', section_topper_marks: '' }
            };

            await axios.post('http://localhost:5000/api/exam/create', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Marksheet Blueprint Created!');
            navigate('/dashboard/results');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create blueprint');
        }
    };

    return (
        <div className="result-dashboard">
            <div className="rd-header">
                <h2>Create New Marksheet Blueprint</h2>
                <button className="btn-view" onClick={() => navigate('/dashboard/results')}>Cancel</button>
            </div>

            <form onSubmit={handleSubmit} style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Exam Name</label>
                        <input
                            required
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Annual Term 2026"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Session</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.session}
                            onChange={e => setFormData({ ...formData, session: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Class</label>
                        <select
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.class_name}
                            onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                        >
                            <option value="">Select Class</option>
                            {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Section</label>
                        <select
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            value={formData.section}
                            onChange={e => setFormData({ ...formData, section: e.target.value })}
                        >
                            <option value="">Select Section</option>
                            {['A', 'B', 'C', 'D'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.show_highest_marks}
                            onChange={e => setFormData({ ...formData, show_highest_marks: e.target.checked })}
                        />
                        <span className="text-sm font-medium text-gray-700">Show "Highest Marks in Class" Column?</span>
                    </label>
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 className="text-lg font-medium text-gray-900">Subjects Blueprint</h3>
                        <button type="button" onClick={handleAddSubject} style={{ color: '#2563eb', fontSize: '13px', fontWeight: 'bold' }}>+ Add Subject</button>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>
                            <div>Subject Name</div>
                            <div>Theory Max</div>
                            <div>Prac Max</div>
                            <div>Pass Marks</div>
                        </div>
                        {subjects.map((sub, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <input
                                    type="text"
                                    value={sub.name}
                                    onChange={e => handleSubjectChange(idx, 'name', e.target.value)}
                                    className="p-2 border rounded"
                                    placeholder="Name"
                                />
                                <input
                                    type="number"
                                    value={sub.max_theory}
                                    onChange={e => handleSubjectChange(idx, 'max_theory', parseInt(e.target.value))}
                                    className="p-2 border rounded"
                                />
                                <input
                                    type="number"
                                    value={sub.max_practical}
                                    onChange={e => handleSubjectChange(idx, 'max_practical', parseInt(e.target.value))}
                                    className="p-2 border rounded"
                                />
                                <input
                                    type="number"
                                    value={sub.passing_marks}
                                    onChange={e => handleSubjectChange(idx, 'passing_marks', parseInt(e.target.value))}
                                    className="p-2 border rounded"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '30px' }}>
                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                        style={{ background: '#2563eb', color: 'white', padding: '12px 20px', border: 'none', borderRadius: '6px', fontWeight: 'bold', width: '100%', cursor: 'pointer' }}
                    >
                        Create Blueprint
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateExam;
