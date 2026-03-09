import pool from './config/db.js';

const repairData = async () => {
    try {
        console.log('🛠️ Repairing orphaned Teachers and Fees data...');

        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');

        for (const inst of institutes.rows) {
            if (!inst.current_session_id) continue;
        }

        console.log('🎉 Data repair complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Repair failed:', err);
        process.exit(1);
    }
};

repairData();
