import pool from './config/db.js';

const createTeacherAttendanceTable = async () => {
    try {
        console.log('⚡ Creating teacher_self_attendance table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_self_attendance (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
                session_id INTEGER REFERENCES academic_sessions(id) ON DELETE CASCADE,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                day VARCHAR(20) NOT NULL,
                status VARCHAR(10) CHECK (status IN ('present', 'absent')),
                marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacher_id, date, session_id)
            );
        `);

        console.log('✅ teacher_self_attendance table created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating table:', err);
        process.exit(1);
    }
};

createTeacherAttendanceTable();
