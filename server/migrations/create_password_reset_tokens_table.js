import pool from '../config/db.js';

const createPasswordResetTokensTable = async () => {
  try {
    const result = await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        institute_id INTEGER NOT NULL UNIQUE,
        otp VARCHAR(6) NOT NULL,
        otp_expiry TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
      );
    `);
    
    console.log('✅ password_reset_tokens table created successfully');
  } catch (error) {
    console.error('❌ Error creating password_reset_tokens table:', error);
  }
};

createPasswordResetTokensTable();
