import pool from './config/db.js';

const createOccasionalMasterTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS occasional_fee_master (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                fee_name VARCHAR(100) NOT NULL,
                default_amount DECIMAL(10, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(institute_id, fee_name)
            )
        `);
        console.log('occasional_fee_master table created successfully');
    } catch (error) {
        console.error('Error creating occasional_fee_master table:', error);
    }
};

createOccasionalMasterTable();
