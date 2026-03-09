import React, { useMemo } from 'react';
import { BASE_URL } from '../../config';
import './ReportCardView.css';

const ReportCardView = ({
    student,
    exam,
    institute,
    result,
    isExporting = false
}) => {

    const marksData = useMemo(() => {
        return typeof result?.marks_data === 'string'
            ? JSON.parse(result.marks_data)
            : result?.marks_data || [];
    }, [result]);

    const gradingRules = useMemo(() => {
        let rules = typeof exam?.grading_rules === 'string'
            ? JSON.parse(exam.grading_rules)
            : exam?.grading_rules || [];
        // Sort rules by min percentage descending for easier lookup
        return [...rules].sort((a, b) => b.min - a.min);
    }, [exam]);

    const subjectsBlueprint = useMemo(() => {
        return typeof exam?.subjects_blueprint === 'string'
            ? JSON.parse(exam.subjects_blueprint)
            : exam?.subjects_blueprint || [];
    }, [exam]);

    const manualStats = useMemo(() => {
        return typeof exam?.manual_stats === 'string'
            ? JSON.parse(exam.manual_stats)
            : exam?.manual_stats || {};
    }, [exam]);

    const calculatedStats = useMemo(() => {
        return typeof result?.calculated_stats === 'string'
            ? JSON.parse(result.calculated_stats)
            : result?.calculated_stats || { total: 0, percentage: 0, grade: 'F' };
    }, [result]);

    // Helper to evaluate addition expressions (e.g. 80+18 -> 98)
    const evaluateMark = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.includes('+')) {
            return val.split('+').reduce((sum, p) => sum + (parseFloat(p.trim()) || 0), 0);
        }
        return parseFloat(val) || 0;
    };

    // Total Max Marks from blueprint
    const totalMax = useMemo(() => {
        return subjectsBlueprint.reduce((sum, sub) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);
    }, [subjectsBlueprint]);

    if (!student || !exam) return <div className="loading-report">Preparing Report Card Data...</div>;

    return (
        <div className={`report-card-container ${isExporting ? 'is-exporting' : ''}`}>
            <div className="report-card">
                <div className="paper-inner-border"></div>
                
                {/* Header */}
                <div className="rc-header">
                    <div className="rc-inst-row">
                        {institute?.logo_url && (
                            <img 
                                src={isExporting ? `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(institute.logo_url)}` : institute.logo_url} 
                                className="rc-logo"
                                crossOrigin={isExporting ? "anonymous" : undefined}
                            />
                        )}
                        <h1 className="rc-inst-name">{institute?.institute_name}</h1>
                    </div>
                    {institute?.affiliation && <p className="rc-inst-affiliation">{institute.affiliation}</p>}
                    <p className="rc-inst-sub">
                        {institute?.address} {institute?.landmark} {institute?.district} {institute?.state} {institute?.pincode}
                    </p>
                    
                    <div className="rc-exam-title-container">
                        <h2 className="rc-exam-title">{exam?.name}</h2>
                    </div>
                </div>

                {/* Student Details */}
                <div className="rc-student-section">
                    <div className="rc-info-grid">
                        <div className="rc-info-row"><div className="rc-info-label">STUDENT NAME</div><div className="rc-info-value">{student?.name}</div></div>
                        <div className="rc-info-row"><div className="rc-info-label">CLASS & SECTION</div><div className="rc-info-value">{student?.class} - {student?.section}</div></div>
                        <div className="rc-info-row"><div className="rc-info-label">ROLL NUMBER</div><div className="rc-info-value">{student?.roll_no}</div></div>
                        <div className="rc-info-row"><div className="rc-info-label">FATHER'S NAME</div><div className="rc-info-value">{student?.father_name || '-'}</div></div>
                        <div className="rc-info-row"><div className="rc-info-label">DATE OF BIRTH</div><div className="rc-info-value">{student?.dob ? new Date(student.dob).toLocaleDateString('en-GB') : '-'}</div></div>
                    </div>
                    <div className="rc-photo-box">
                        <img
                            src={isExporting
                                ? `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(student?.photo_url || student?.profile_image || '')}`
                                : (student?.photo_url || student?.profile_image || 'https://via.placeholder.com/150')}
                            alt="Student"
                            className="rc-photo"
                            crossOrigin={isExporting ? "anonymous" : undefined}
                        />
                    </div>
                </div>

                {/* Marks Table */}
                <div className="rc-table-wrapper">
                    <table className="rc-table">
                        <thead className="rc-table-header">
                            <tr>
                                <th className="rc-text-left" style={{ width: '35%' }}>SUBJECT</th>
                                <th>MAX</th>
                                <th>PASS</th>
                                <th>OBT</th>
                                {!!exam.show_highest_marks && <th>HIGH</th>}
                                <th>GRADE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subjectsBlueprint.map((sub, index) => {
                                const res = marksData.find(m => m.subject === sub.name) || {};
                                const highest = manualStats[`highest_${sub.name}`] || '-';
                                return (
                                    <tr key={index} className={`rc-table-row ${index % 2 === 1 ? 'alternate' : ''}`}>
                                        <td className="rc-text-left" style={{ fontWeight: '900', color: '#1e293b' }}>{sub.name}</td>
                                        <td>{(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</td>
                                        <td>{sub.passing_marks || '-'}</td>
                                        <td style={{ color: '#4f46e5', fontSize: '12px', fontWeight: '900' }}>{res.theory || '-'}</td>
                                        {!!exam.show_highest_marks && <td style={{ color: '#6366f1' }}>{highest}</td>}
                                        <td style={{ fontWeight: '900' }}>{res.grade || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                <div className="rc-summary-box">
                    <div className="rc-summary-item">
                        <div className="rc-summary-label">GRAND TOTAL</div>
                        <div className="rc-summary-value">{calculatedStats.total} / {totalMax}</div>
                    </div>
                    <div className="rc-summary-item">
                        <div className="rc-summary-label">PERCENTAGE</div>
                        <div className="rc-summary-value">{calculatedStats.percentage}%</div>
                    </div>
                    <div className="rc-summary-item">
                        <div className="rc-summary-label">FINAL GRADE</div>
                        <div className="rc-summary-value" style={{ color: '#fbbf24' }}>{calculatedStats.grade}</div>
                    </div>
                </div>

                {/* Achievement Medals */}
                {(manualStats.section_topper_name || manualStats.class_topper_name) && (
                    <div className="rc-medal-row">
                        {manualStats.section_topper_name && (
                            <div className="rc-medal">
                                <span className="rc-medal-icon">🏆</span>
                                <div style={{ flex: 1 }}>
                                    <div className="rc-medal-text">Section Topper: {manualStats.section_topper_name}</div>
                                    <div className="rc-medal-score">Score: {manualStats.section_topper_total} / {totalMax}</div>
                                </div>
                            </div>
                        )}
                        {manualStats.class_topper_name && (
                            <div className="rc-medal">
                                <span className="rc-medal-icon">🎖️</span>
                                <div style={{ flex: 1 }}>
                                    <div className="rc-medal-text">Class Topper: {manualStats.class_topper_name}</div>
                                    <div className="rc-medal-score">Score: {manualStats.class_topper_total} / {totalMax}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Remarks */}
                <div className="rc-remarks">
                    <div className="rc-remark-title">OFFICIAL REMARKS</div>
                    <div className="rc-remark-text">"{result?.overall_remark || 'Satisfactory performance. Aim for higher goals in the next academic term.'}"</div>
                </div>

                {/* Signatures */}
                <div className="rc-signatures">
                    <div className="rc-sig-line"><span className="rc-sig-text">TEACHER</span></div>
                    <div className="rc-sig-line"><span className="rc-sig-text">PRINCIPAL</span></div>
                    <div className="rc-sig-line"><span className="rc-sig-text">PARENT</span></div>
                </div>
            </div>
        </div>
    );
};

export default ReportCardView;

