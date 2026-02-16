import pool from './config/db.js';

async function createHomeworkCompletionsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS homework_completions (
                id SERIAL PRIMARY KEY,
                homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(homework_id, student_id)
            );
        `);
        console.log('✅ Homework completions table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating homework completions table:', error);
        process.exit(1);
    }
}

createHomeworkCompletionsTable();
