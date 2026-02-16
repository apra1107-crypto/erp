import pool from './config/db.js';

const createAbsentRequestsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS absent_requests (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id),
                institute_id INTEGER REFERENCES institutes(id),
                class VARCHAR(10),
                section VARCHAR(10),
                date DATE NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
                approved_by_teacher_id INTEGER REFERENCES teachers(id),
                approved_by_teacher_name VARCHAR(255),
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, date)
            );
        `);

        console.log('✅ Absent requests table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

createAbsentRequestsTable();
