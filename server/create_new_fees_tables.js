import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createFeesTables = async () => {
    try {
        await pool.query(`
            -- Master configuration for a specific month
            CREATE TABLE fee_configurations (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                month_year VARCHAR(20) NOT NULL, -- e.g., 'February 2026'
                columns JSONB NOT NULL DEFAULT '["Tuition", "Transport"]', -- List of all labels
                class_data JSONB NOT NULL, -- { "Class 1": { "Tuition": 1000, "Transport": 400 }, ... }
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(institute_id, month_year)
            );

            -- Individual student fee records
            CREATE TABLE student_monthly_fees (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                config_id INTEGER REFERENCES fee_configurations(id) ON DELETE CASCADE,
                month_year VARCHAR(20) NOT NULL,
                breakdown JSONB NOT NULL, -- The final amounts for this specific student
                total_amount DECIMAL(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid'
                payment_id VARCHAR(100),
                paid_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, month_year)
            );
        `);
        console.log('✅ New Fees tables created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating fees tables:', error);
        process.exit(1);
    }
};

createFeesTables();
