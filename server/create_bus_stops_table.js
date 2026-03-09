import pool from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createBusStopsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bus_stops (
                id SERIAL PRIMARY KEY,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                stop_name VARCHAR(255) NOT NULL,
                order_index INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Bus stops table created');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

createBusStopsTable();
