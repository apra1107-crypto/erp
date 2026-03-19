import pool from '../config/db.js';

const createFeeActivationTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS monthly_fee_activations (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                is_activated BOOLEAN DEFAULT FALSE,
                activated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(institute_id, session_id, month, year)
            );
        `);
        console.log('✅ monthly_fee_activations table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

createFeeActivationTable();
