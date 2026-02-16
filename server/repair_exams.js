import pool from './config/db.js';

const repairExamData = async () => {
    try {
        console.log('🛠️ Repairing Exam and Result data...');

        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');

        for (const inst of institutes.rows) {
            if (!inst.current_session_id) continue;

            // 1. Repair Exams
            const eRes = await pool.query(
                'UPDATE exams SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${eRes.rowCount} exams for Institute ${inst.id}`);

            // 2. Repair Student Exam Results
            const rRes = await pool.query(
                'UPDATE student_exam_results SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${rRes.rowCount} student results for Institute ${inst.id}`);
        }

        console.log('🎉 Exam data repair complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Repair failed:', err);
        process.exit(1);
    }
};

repairExamData();
