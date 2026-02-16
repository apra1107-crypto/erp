import pool from '../config/db.js';

const createRoutinesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS class_routines (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                class_name VARCHAR(50) NOT NULL,
                section VARCHAR(50) NOT NULL,
                config JSONB NOT NULL, -- Stores { schoolStartTime, periodDuration, days, periodsCount, lunchAfter }
                data JSONB NOT NULL,   -- Stores the actual schedule { "Monday": [ { subject, teacher_id }, ... ], ... }
                is_published BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(institute_id, class_name, section)
            );
        `);
        console.log('✅ Class Routines table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating class routines table:', error);
        process.exit(1);
    }
};

createRoutinesTable();
