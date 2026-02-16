import pool from './config/db.js';

const createExamTables = async () => {
    try {
        console.log('🔄 Creating Exam Tables...');

        // 1. Create exams table (The Blueprint)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS exams (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id),
                name VARCHAR(255) NOT NULL,
                session VARCHAR(50),
                class_name VARCHAR(50),
                section VARCHAR(50),
                show_highest_marks BOOLEAN DEFAULT false,
                grading_rules JSONB DEFAULT '[]',
                subjects_blueprint JSONB DEFAULT '[]',
                manual_stats JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Create student_exam_results table (The Marks)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_exam_results (
                id SERIAL PRIMARY KEY,
                exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                institute_id INTEGER REFERENCES institutes(id),
                marks_data JSONB DEFAULT '[]',
                overall_remark TEXT,
                calculated_stats JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(exam_id, student_id)
            );
        `);

        console.log('✅ Exam tables created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

createExamTables();
