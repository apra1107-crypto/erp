import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createBusTripsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bus_trips (
                id SERIAL PRIMARY KEY,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                log_date DATE NOT NULL,
                type VARCHAR(20) NOT NULL, -- 'pickup' or 'drop'
                status VARCHAR(20) DEFAULT 'started', -- 'started', 'completed'
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(bus_id, log_date, type)
            )
        `);
        console.log('✅ Bus trips table created');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

createBusTripsTable();
