import pool from './config/db.js';

const createAttendanceTables = async () => {
    try {
        // Create attendance table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id),
                teacher_id INTEGER REFERENCES teachers(id),
                student_id INTEGER REFERENCES students(id),
                class VARCHAR(10),
                section VARCHAR(10),
                date DATE NOT NULL,
                status VARCHAR(10) CHECK (status IN ('present', 'absent')),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(student_id, date)
            );
        `);

        // Create attendance_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id),
                teacher_id INTEGER REFERENCES teachers(id),
                teacher_name VARCHAR(255),
                class VARCHAR(10),
                section VARCHAR(10),
                date DATE NOT NULL,
                action_type VARCHAR(20) CHECK (action_type IN ('initial', 'modified')),
                total_students INTEGER,
                present_count INTEGER,
                absent_count INTEGER,
                changes_made TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('✅ Attendance tables created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

createAttendanceTables();
