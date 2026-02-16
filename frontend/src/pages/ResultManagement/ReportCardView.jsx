import React, { useMemo } from 'react';
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

    // Check if any subject has a manual grade filled
    const hasSubjectGrades = useMemo(() => {
        return marksData.some(m => m.grade && m.grade.trim() !== '');
    }, [marksData]);

    if (!student || !exam) return <div className="loading-report">Preparing Report Card Data...</div>;

    return (
        <div className={`report-card-container ${isExporting ? 'is-exporting' : ''}`}>
            <div className="report-card-box">
                <div className="report-card-inner">
                    {/* Decorative Top Border */}
                    <div className="card-top-bar"></div>

                    {/* Header Section */}
                    {/* New Refined Header Section */}
                    <div className="card-header">
                        {/* ... existing header content ... */}
                        <div className="header-primary-row">
                            <div className="institute-brand-sync">
                                {institute?.logo_url ? (
                                    <img
                                        src={isExporting ? `http://localhost:5000/api/proxy-image?url=${encodeURIComponent(institute.logo_url)}` : institute.logo_url}
                                        alt="Logo"
                                        className="header-logo-img"
                                        crossOrigin={isExporting ? "anonymous" : undefined}
                                    />
                                ) : (
                                    <div className="logo-placeholder-circle">{institute?.institute_name?.charAt(0)}</div>
                                )}
                                <h1 className="institute-name-main">{institute?.institute_name}</h1>
                            </div>
                        </div>
                        <div className="header-secondary-info">
                            <p className="inst-address-line">
                                {institute?.address} {institute?.district} {institute?.state} {institute?.pincode}
                            </p>
                            <p className="inst-affiliation-line">
                                {institute?.affiliation || 'Affiliated to CBSE / State Board'}
                            </p>
                        </div>
                    </div>

                    {/* Free Colourful Exam Title - Positioned above student details */}
                    <div className="centered-exam-label">
                        <h2 className="exam-title-colorful">
                            {exam?.name || 'Academic Report Card'}
                        </h2>
                    </div>

                    {/* Student Information Section with Photo on Right */}
                    <div className="student-meta-section-container">
                        <div className="meta-details-left">
                            <div className="meta-grid-new">
                                <div className="meta-item">
                                    <label>Student Name</label>
                                    <span className="value-name">{student?.name}</span>
                                </div>
                                <div className="meta-item">
                                    <label>Class & Section</label>
                                    <span>{student?.class} - {student?.section}</span>
                                </div>
                                <div className="meta-item">
                                    <label>Roll Number</label>
                                    <span>{student?.roll_no}</span>
                                </div>

                                {/* Second Row */}
                                <div className="meta-item">
                                    <label>Father's Name</label>
                                    <span>{student?.father_name || '-'}</span>
                                </div>
                                <div className="meta-item">
                                    <label>Mother's Name</label>
                                    <span>{student?.mother_name || '-'}</span>
                                </div>
                                <div className="meta-item">
                                    <label>Date of Birth</label>
                                    <span>{student?.dob ? new Date(student.dob).toLocaleDateString('en-GB') : '-'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="meta-photo-right">
                            <div className="student-profile-raw">
                                <img
                                    src={isExporting
                                        ? `http://localhost:5000/api/proxy-image?url=${encodeURIComponent(student?.photo_url || student?.profile_image || '')}`
                                        : (student?.photo_url || student?.profile_image || 'https://via.placeholder.com/150')}
                                    alt="Student"
                                    crossOrigin={isExporting ? "anonymous" : undefined}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Marks Table */}
                    <div className="marks-table-section">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th className="text-left">Subject</th>
                                    <th>Max Marks</th>
                                    <th>Pass Marks</th>
                                    <th>Obtained</th>
                                    {exam?.show_highest_marks && <th>Highest</th>}
                                    {hasSubjectGrades && <th>Grade</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {subjectsBlueprint.map((subject, index) => {
                                    const res = marksData.find(m => m.subject === subject.name) || {};
                                    const rawObtained = res.theory; // Display the original string (e.g. 80+18)
                                    const highest = manualStats[`highest_${subject.name}`] || '-';

                                    return (
                                        <tr key={index}>
                                            <td className="subject-name">{subject.name}</td>
                                            <td>{(parseFloat(subject.max_theory) || 0) + (parseFloat(subject.max_practical) || 0)}</td>
                                            <td>{subject.passing_marks || '-'}</td>
                                            <td className="font-bold">{rawObtained || '-'}</td>
                                            {exam?.show_highest_marks && <td>{highest}</td>}
                                            {hasSubjectGrades && (
                                                <td>
                                                    <span className="grade-badge">{res.grade || '-'}</span>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="total-row">
                                    <td colSpan={3} className="text-right">GRAND TOTAL</td>
                                    <td className="total-val">{calculatedStats.total} / {totalMax}</td>
                                    {exam?.show_highest_marks && <td></td>}
                                    {hasSubjectGrades ? (
                                        <td className="final-grade">{calculatedStats.grade}</td>
                                    ) : (
                                        <td className="final-grade" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                            Grade: {calculatedStats.grade}
                                        </td>
                                    )}
                                </tr>
                            </tfoot>
                        </table>

                        <div className="percentage-display">
                            <span>Aggregate Percentage: <b>{calculatedStats.percentage}%</b></span>
                        </div>
                    </div>

                    {/* Toppers Section */}
                    {(manualStats.section_topper_name || manualStats.class_topper_name) && (
                        <div className="toppers-medal-section">
                            {manualStats.section_topper_name && (
                                <div className="medal-item">
                                    <span className="label">Section Topper:</span>
                                    <span className="value">{manualStats.section_topper_name} ({manualStats.section_topper_total})</span>
                                </div>
                            )}
                            {manualStats.class_topper_name && (
                                <div className="medal-item">
                                    <span className="label">Class Topper:</span>
                                    <span className="value">{manualStats.class_topper_name} ({manualStats.class_topper_total})</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Remarks Section */}
                    <div className="remarks-row">
                        <div className="remarks-box">
                            <h3>General Remarks</h3>
                            <p className="remark-text">"{result?.overall_remark || 'Satisfactory performance. Keep working hard to achieve higher goals.'}"</p>
                        </div>

                        <div className="grading-scale-box">
                            <h3>Grading System</h3>
                            <div className="scale-list">
                                {gradingRules.map((r, i) => (
                                    <div key={i} className="scale-item">
                                        <span className="scale-grade">{r.grade}</span>
                                        <span className="scale-range">{r.min}% - {r.max}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Signatures */}
                    <div className="report-footer">
                        <div className="signature-area">
                            <div className="sig-block">
                                <div className="sig-line"></div>
                                <span>Class Teacher</span>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line"></div>
                                <span>Principal</span>
                            </div>
                            <div className="sig-block">
                                <div className="sig-line"></div>
                                <span>Parent Signature</span>
                            </div>
                        </div>
                        <div className="footer-disclaimer">
                            Computer generated report card. Verification required for official purposes.
                        </div>
                    </div>

                    <div className="card-bottom-bar"></div>
                </div>
            </div>
        </div>
    );
};

export default ReportCardView;

