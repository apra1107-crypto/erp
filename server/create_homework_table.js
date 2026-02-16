import pool from './config/db.js';

async function createHomeworkTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS homework (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                session_id INTEGER NOT NULL,
                class VARCHAR(50) NOT NULL,
                section VARCHAR(50) NOT NULL,
                subject VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Homework table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating homework table:', error);
        process.exit(1);
    }
}

createHomeworkTable();