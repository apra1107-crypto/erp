import pool from './config/db.js';

const repairData = async () => {
    try {
        console.log('🛠️ Repairing orphaned Teachers and Fees data...');

        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');

        for (const inst of institutes.rows) {
            if (!inst.current_session_id) continue;

            // 1. Repair Monthly Fees
            const fRes = await pool.query(
                'UPDATE student_monthly_fees SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${fRes.rowCount} monthly fees for Institute ${inst.id}`);

            // 3. Repair Occasional Fees
            const oRes = await pool.query(
                'UPDATE student_occasional_fees SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${oRes.rowCount} occasional fees for Institute ${inst.id}`);
        }

        console.log('🎉 Data repair complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Repair failed:', err);
        process.exit(1);
    }
};

repairData();
