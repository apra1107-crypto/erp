import pool from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createBusStopAssignmentsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bus_stop_assignments (
                id SERIAL PRIMARY KEY,
                stop_id INTEGER REFERENCES bus_stops(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, bus_id) -- A student can only be assigned to one stop per bus/route
            )
        `);
        console.log('✅ Bus stop assignments table created');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

createBusStopAssignmentsTable();
