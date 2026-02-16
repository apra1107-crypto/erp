import pool from './config/db.js';

const repairFeeConfigs = async () => {
    try {
        console.log('🛠️ Repairing Fee Configurations and Master Data...');

        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');

        for (const inst of institutes.rows) {
            if (!inst.current_session_id) continue;

            // 1. Repair Fee Configurations
            const configRes = await pool.query(
                'UPDATE fee_configurations SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${configRes.rowCount} fee configurations for Institute ${inst.id}`);

            // 2. Repair Occasional Fee Master
            const masterRes = await pool.query(
                'UPDATE occasional_fee_master SET session_id = $1 WHERE institute_id = $2 AND session_id IS NULL',
                [inst.current_session_id, inst.id]
            );
            console.log(`✅ Repaired ${masterRes.rowCount} occasional master types for Institute ${inst.id}`);
        }

        console.log('🎉 Final fee repair complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Repair failed:', err);
        process.exit(1);
    }
};

repairFeeConfigs();
