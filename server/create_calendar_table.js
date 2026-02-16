import pool from './config/db.js';

const createCalendarTable = async () => {
  const client = await pool.connect();
  try {
    console.log('Creating academic_calendar table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_calendar (
        id SERIAL PRIMARY KEY,
        institute_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_type VARCHAR(50) DEFAULT 'event', -- 'holiday', 'exam', 'event'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Academic calendar table created successfully');
  } catch (err) {
    console.error('❌ Error creating academic calendar table:', err);
  } finally {
    client.release();
    process.exit();
  }
};

createCalendarTable();
