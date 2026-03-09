import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createTransportLogsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transport_logs (
                id SERIAL PRIMARY KEY,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                stop_id INTEGER REFERENCES bus_stops(id) ON DELETE CASCADE,
                log_date DATE DEFAULT CURRENT_DATE,
                type VARCHAR(20) NOT NULL, -- 'pickup' or 'drop'
                status VARCHAR(20) NOT NULL, -- 'boarded', 'dropped', 'absent'
                marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(bus_id, student_id, log_date, type)
            )
        `);
        console.log('✅ Transport logs table created');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

createTransportLogsTable();
