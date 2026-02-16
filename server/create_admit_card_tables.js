import pool from './config/db.js';

const createAdmitCardTables = async () => {
    try {
        // Table for Admit Cards (Exam definition and class/section linking)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admit_cards (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER REFERENCES teachers(id),
                institute_id INTEGER REFERENCES institutes(id),
                exam_name VARCHAR(255) NOT NULL,
                classes JSONB NOT NULL, -- Array of {class, section}
                schedule JSONB NOT NULL, -- Array of {date, day, subject, time}
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Admit Card tables created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admit card tables:', error);
        process.exit(1);
    }
};

createAdmitCardTables();
