import pool from './config/db.js';

const createSalaryTable = async () => {
    try {
        console.log('⚡ Creating teacher_salaries table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_salaries (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
                session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE,
                amount DECIMAL(12, 2) NOT NULL,
                month_year VARCHAR(50) NOT NULL, -- e.g. "February 2026"
                status VARCHAR(20) DEFAULT 'paid',
                paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_id VARCHAR(100),
                UNIQUE(teacher_id, month_year, session_id)
            );
        `);

        console.log('✅ teacher_salaries table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating salary table:', err);
        process.exit(1);
    }
};

createSalaryTable();
