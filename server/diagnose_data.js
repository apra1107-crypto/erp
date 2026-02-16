import pool from './config/db.js';

const diagnoseMissingData = async () => {
    try {
        console.log('🔍 Diagnosing missing Teachers and Fees data...');

        const institutes = await pool.query('SELECT id, institute_name, current_session_id FROM institutes');
        console.table(institutes.rows);

        for (const inst of institutes.rows) {
            console.log(`\n--- Checking: ${inst.institute_name} (Session: ${inst.current_session_id}) ---`);

            const studentCount = await pool.query('SELECT COUNT(*) FROM students WHERE institute_id = $1 AND session_id = $2', [inst.id, inst.current_session_id]);
            console.log(`Students in Session: ${studentCount.rows[0].count}`);

            const teacherCount = await pool.query('SELECT COUNT(*) FROM teachers WHERE institute_id = $1 AND is_active = true', [inst.id]);
            console.log(`Teachers (Active): ${teacherCount.rows[0].count}`);

            const feeCount = await pool.query('SELECT COUNT(*) FROM student_monthly_fees WHERE institute_id = $1 AND session_id = $2', [inst.id, inst.current_session_id]);
            const orphanFees = await pool.query('SELECT COUNT(*) FROM student_monthly_fees WHERE institute_id = $1 AND session_id IS NULL', [inst.id]);
            console.log(`Monthly Fees in Session: ${feeCount.rows[0].count}`);
            console.log(`Monthly Fees NULL session: ${orphanFees.rows[0].count}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Diagnosis failed:', err);
        process.exit(1);
    }
};

diagnoseMissingData();