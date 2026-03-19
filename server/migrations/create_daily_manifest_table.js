import pool from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createDailyManifestTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bus_daily_manifest (
                id SERIAL PRIMARY KEY,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                stop_id INTEGER REFERENCES bus_stops(id) ON DELETE CASCADE,
                log_date DATE NOT NULL,
                type VARCHAR(20) NOT NULL, -- 'pickup' or 'drop'
                UNIQUE(bus_id, student_id, log_date, type)
            )
        `);
        console.log('✅ Bus daily manifest table created');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

createDailyManifestTable();
