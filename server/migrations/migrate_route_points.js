import pool from '../config/db.js';
import dotenv from 'dotenv';
dotenv.config();

const migrateRoutePoints = async () => {
    try {
        await pool.query(`
            ALTER TABLE buses 
            ADD COLUMN IF NOT EXISTS start_point VARCHAR(255),
            ADD COLUMN IF NOT EXISTS end_point VARCHAR(255);
        `);
        console.log('✅ Route points columns added to buses table');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        process.exit();
    }
};

migrateRoutePoints();
