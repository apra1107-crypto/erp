import pool from '../config/db.js';

const migrate = async () => {
  try {
    console.log('🚀 Adding push_sent_at column to attendance_logs...');
    await pool.query(`
      ALTER TABLE attendance_logs 
      ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✅ Column added successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
