#!/usr/bin/env node

import pool from '../config/db.js';

const setupPasswordResetTable = async () => {
  try {
    console.log('🔧 Setting up password reset tokens table...');

    // Check if table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'password_reset_tokens'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('✅ password_reset_tokens table already exists');
      process.exit(0);
    }

    // Create the table
    const result = await pool.query(`
      CREATE TABLE password_reset_tokens (
        id SERIAL PRIMARY KEY,
        institute_id INTEGER NOT NULL UNIQUE,
        otp VARCHAR(6) NOT NULL,
        otp_expiry TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
      );
    `);
    
    console.log('✅ password_reset_tokens table created successfully');
    
    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_institute_id 
      ON password_reset_tokens(institute_id);
    `);
    
    console.log('✅ Index created for faster lookups');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up table:', error.message);
    process.exit(1);
  }
};

setupPasswordResetTable();
