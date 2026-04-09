#!/usr/bin/env node

import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const debugPasswordReset = async () => {
  try {
    console.log('🔍 ===== PASSWORD RESET DEBUG =====\n');

    // 1. Check if table exists
    console.log('1️⃣ Checking password_reset_tokens table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'password_reset_tokens'
      );
    `);
    console.log(`   Table exists: ${tableCheck.rows[0].exists ? '✅ YES' : '❌ NO'}\n`);

    if (!tableCheck.rows[0].exists) {
      console.log('   ⚠️  Creating table now...');
      await pool.query(`
        CREATE TABLE password_reset_tokens (
          id SERIAL PRIMARY KEY,
          institute_id INTEGER NOT NULL UNIQUE,
          otp VARCHAR(6) NOT NULL,
          otp_expiry TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
        );
      `);
      console.log('   ✅ Table created!\n');
    }

    // 2. Check institutes table
    console.log('2️⃣ Checking institutes table...');
    const instituteCount = await pool.query('SELECT COUNT(*) FROM institutes;');
    console.log(`   Total institutes: ${instituteCount.rows[0].count}\n`);

    // 3. Check if email exists in institutes
    const testEmail = 'admin@test.com'; // Change this to an actual test email
    console.log(`3️⃣ Looking for test institute with email: ${testEmail}`);
    const instituteCheck = await pool.query(
      'SELECT id, institute_name, email FROM institutes WHERE LOWER(email) = $1',
      [testEmail.toLowerCase()]
    );
    
    if (instituteCheck.rows.length > 0) {
      console.log(`   ✅ Found: ${JSON.stringify(instituteCheck.rows[0])}\n`);
    } else {
      console.log(`   ❌ Not found\n`);
      console.log('   Available institutes:');
      const allInstitutes = await pool.query('SELECT id, institute_name, email FROM institutes LIMIT 5;');
      allInstitutes.rows.forEach(inst => {
        console.log(`     - ${inst.institute_name} (${inst.email})`);
      });
      console.log();
    }

    console.log('4️⃣ Cloud Storage (EOS) Configuration:');
    console.log(`   EOS_REGION: ${process.env.EOS_REGION ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   EOS_ACCESS_KEY: ${process.env.EOS_ACCESS_KEY ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   EOS_SECRET_KEY: ${process.env.EOS_SECRET_KEY ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   EOS_BUCKET: ${process.env.EOS_BUCKET ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   EOS_ENDPOINT: ${process.env.EOS_ENDPOINT ? '✅ SET' : '❌ NOT SET'}\n`);

    if (!process.env.EOS_REGION || !process.env.EOS_ACCESS_KEY || !process.env.EOS_SECRET_KEY) {
      console.log('   ⚠️  Cloud storage credentials are missing! Image uploads will fail.\n');
    }

    // 5. Check if generateOTP and sendPasswordResetOTP are importable
    console.log('5️⃣ Checking AWS utilities...');
    try {
      const { generateOTP, sendPasswordResetOTP } = await import('../utils/aws.js');
      console.log('   ✅ generateOTP function: Available');
      console.log('   ✅ sendPasswordResetOTP function: Available\n');

      // Test OTP generation
      const testOtp = generateOTP();
      console.log(`   Test OTP generated: ${testOtp} (length: ${testOtp.length})\n`);
    } catch (error) {
      console.log(`   ❌ Error importing AWS utilities: ${error.message}\n`);
    }

    // 6. Test a mock password reset flow
    console.log('6️⃣ Testing password reset flow with first institute...');
    const firstInstitute = await pool.query('SELECT id, email FROM institutes LIMIT 1;');
    
    if (firstInstitute.rows.length > 0) {
      const institute = firstInstitute.rows[0];
      console.log(`   Using institute: ID=${institute.id}, Email=${institute.email}`);

      // Generate OTP
      const { generateOTP } = await import('../utils/aws.js');
      const testOtp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      console.log(`   Generated OTP: ${testOtp}, Expiry: ${otpExpiry}`);

      // Try to store in database
      try {
        await pool.query(
          `INSERT INTO password_reset_tokens (institute_id, otp, otp_expiry) 
           VALUES ($1, $2, $3)
           ON CONFLICT (institute_id) DO UPDATE SET otp = $2, otp_expiry = $3`,
          [institute.id, testOtp, otpExpiry]
        );
        console.log('   ✅ OTP stored in database successfully\n');
      } catch (dbError) {
        console.log(`   ❌ Database error: ${dbError.message}\n`);
      }

      // Check stored OTP
      const storedOtp = await pool.query(
        'SELECT otp, otp_expiry FROM password_reset_tokens WHERE institute_id = $1',
        [institute.id]
      );
      if (storedOtp.rows.length > 0) {
        console.log(`   ✅ Retrieved OTP from database: ${storedOtp.rows[0].otp}\n`);
      }
    } else {
      console.log('   ❌ No institutes found in database\n');
    }

    console.log('🔍 ===== DEBUG COMPLETE =====\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Debug error:', error);
    process.exit(1);
  }
};

debugPasswordReset();
