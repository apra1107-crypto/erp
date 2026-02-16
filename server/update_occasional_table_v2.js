import pool from './config/db.js';

const updateOccasionalTable = async () => {
    try {
        await pool.query(`
            ALTER TABLE student_occasional_fees 
            ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);
        `);
        console.log('student_occasional_fees table updated with batch_id');
    } catch (error) {
        console.error('Error updating occasional table:', error);
    }
};

updateOccasionalTable();
