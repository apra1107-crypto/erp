import pool from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const createTransportTables = async () => {
    try {
        // Create buses table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS buses (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                bus_number VARCHAR(50) NOT NULL,
                driver_name VARCHAR(255) NOT NULL,
                driver_mobile VARCHAR(20),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Buses table created');

        // Create bus_staff table (for conductors, helpers etc)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bus_staff (
                id SERIAL PRIMARY KEY,
                bus_id INTEGER REFERENCES buses(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                mobile VARCHAR(20),
                role VARCHAR(50) DEFAULT 'Staff',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Bus staff table created');

    } catch (error) {
        console.error('❌ Error creating transport tables:', error);
    } finally {
        process.exit();
    }
};

createTransportTables();
