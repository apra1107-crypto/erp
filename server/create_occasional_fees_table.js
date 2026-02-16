import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createOccasionalFeesTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_occasional_fees (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                month_year VARCHAR(20) NOT NULL,
                fee_name VARCHAR(100) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'unpaid',
                payment_id VARCHAR(100),
                paid_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Occasional Fees table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating table:', error);
        process.exit(1);
    }
};

createOccasionalFeesTable();
