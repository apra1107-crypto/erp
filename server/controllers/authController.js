import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { sendWelcomeEmail, generateOTP, sendPasswordResetOTP } from '../utils/aws.js';
import fs from 'fs';
import path from 'path';

// Register Institute
const registerInstitute = async (req, res) => {
  try {
    let {
      institute_name,
      principal_name,
      email,
      mobile,
      state,
      district,
      landmark,
      pincode,
      address,
      password,
    } = req.body;

    // Normalize
    email = email?.trim().toLowerCase();
    password = password?.trim();
    institute_name = institute_name?.trim();
    principal_name = principal_name?.trim();

    // Validation
    if (!institute_name || !principal_name || !email || !mobile || !password) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Check if email already exists
    const existingInstitute = await pool.query(
      'SELECT * FROM institutes WHERE LOWER(email) = $1',
      [email]
    );

    if (existingInstitute.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert institute
    const result = await pool.query(
      `INSERT INTO institutes 
      (institute_name, principal_name, email, mobile, state, district, landmark, pincode, address, password) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id, institute_name, principal_name, email, mobile, created_at`,
      [institute_name, principal_name, email, mobile, state, district, landmark, pincode, address, hashedPassword]
    );

    // Send welcome email (don't wait for it, send in background)
    sendWelcomeEmail(email, institute_name, principal_name).catch(err => {
      console.error('Failed to send welcome email, but registration succeeded:', err);
    });

    res.status(201).json({
      message: 'Institute registered successfully',
      institute: result.rows[0],
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login Institute
const loginInstitute = async (req, res) => {
  try {
    const { email, password } = req.body;
    const logPath = path.join(process.cwd(), 'login_debug.log');
    const timestamp = new Date().toISOString();

    fs.appendFileSync(logPath, `\n[${timestamp}] Login Attempt: email="${email}", passLen=${password?.length}\n`);

    // Validation
    if (!email || !password) {
      fs.appendFileSync(logPath, `[${timestamp}] Failed: Missing credentials\n`);
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Trim and normalize
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Check if institute exists (Case-insensitive)
    const result = await pool.query(
      'SELECT * FROM institutes WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      fs.appendFileSync(logPath, `[${timestamp}] Failed: User not found with email "${normalizedEmail}"\n`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const institute = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(trimmedPassword, institute.password);

    if (!isPasswordValid) {
      fs.appendFileSync(logPath, `[${timestamp}] Failed: Password mismatch for "${normalizedEmail}"\n`);
      // Optional: don't log the password, but log lengths for comparison
      fs.appendFileSync(logPath, `[${timestamp}] Debug: Input length ${trimmedPassword.length}, DB length ${institute.password.length}\n`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    fs.appendFileSync(logPath, `[${timestamp}] Success: Logged in as "${normalizedEmail}"\n`);

    // Generate JWT token
    const token = jwt.sign(
      {
        id: institute.id,
        name: institute.principal_name,
        email: institute.email,
        role: 'principal',
        institute_id: institute.id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    // Remove password from response
    delete institute.password;

    res.status(200).json({
      message: 'Login successful',
      token,
      institute,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Update Push Token
const updatePushToken = async (req, res) => {
  try {
    const institute_id = req.user.id;
    const { push_token } = req.body;

    if (!push_token) {
      return res.status(400).json({ message: 'Push token is required' });
    }

    await pool.query(
      'UPDATE institutes SET push_token = $1 WHERE id = $2',
      [push_token, institute_id]
    );

    res.status(200).json({ message: 'Push token updated successfully' });
  } catch (error) {
    console.error('Update institute push token error:', error);
    res.status(500).json({ message: 'Server error while updating push token' });
  }
};

export { registerInstitute, loginInstitute, initiatePasswordReset, verifyOTP, verifyOTPAndReset, getInstituteByEmail, updatePushToken };

// Initiate Password Reset - Send OTP
const initiatePasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔍 Password reset initiated for:', email);

    // Validation
    if (!email) {
      return res.status(400).json({ message: 'Please provide email' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if institute exists
    const result = await pool.query(
      'SELECT id, email FROM institutes WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      console.log('❌ No institute found with email:', normalizedEmail);
      return res.status(404).json({ message: 'No institute found with this email' });
    }

    const institute = result.rows[0];
    console.log('✅ Institute found:', institute.id);

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    console.log('📝 Generated OTP:', otp);

    // Store OTP in database
    try {
      await pool.query(
        `INSERT INTO password_reset_tokens (institute_id, otp, otp_expiry) 
         VALUES ($1, $2, $3)
         ON CONFLICT (institute_id) DO UPDATE SET otp = $2, otp_expiry = $3`,
        [institute.id, otp, otpExpiry]
      );
      console.log('✅ OTP stored in database');
    } catch (dbError) {
      console.error('❌ Database error storing OTP:', dbError.message);
      return res.status(500).json({ message: 'Failed to store OTP. Please run migration: node migrations/create_password_reset_tokens_table.js' });
    }

    // Send OTP via email
    console.log('📧 Sending OTP email to:', institute.email);
    const emailResult = await sendPasswordResetOTP(institute.email, otp);

    if (emailResult.success) {
      console.log('✅ OTP email sent successfully');
      res.status(200).json({
        message: 'OTP sent to registered email',
        email: institute.email,
      });
    } else {
      console.error('❌ Failed to send email:', emailResult.error);
      return res.status(500).json({ message: 'Failed to send OTP: ' + emailResult.error });
    }
  } catch (error) {
    console.error('❌ Password reset initiation error:', error);
    res.status(500).json({ message: 'Server error during password reset: ' + error.message });
  }
};

// Verify OTP and Reset Password
const verifyOTPAndReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log('🔐 Password reset verification initiated');

    // Validation
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, OTP, and new password' });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      return res.status(400).json({ message: 'OTP must be exactly 6 digits' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = newPassword.trim();

    // Check if institute exists
    const instituteResult = await pool.query(
      'SELECT id, email FROM institutes WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (instituteResult.rows.length === 0) {
      console.log('❌ Institute not found for email:', normalizedEmail);
      return res.status(404).json({ message: 'Institute not found with this email' });
    }

    const instituteId = instituteResult.rows[0].id;

    // Check OTP
    const tokenResult = await pool.query(
      `SELECT otp, otp_expiry FROM password_reset_tokens 
       WHERE institute_id = $1`,
      [instituteId]
    );

    if (tokenResult.rows.length === 0) {
      console.log('❌ No OTP record found for institute:', instituteId);
      return res.status(401).json({ message: 'No OTP record found. Please request a new OTP.' });
    }

    const { otp: storedOtp, otp_expiry } = tokenResult.rows[0];

    // Check if OTP is expired
    if (new Date() > new Date(otp_expiry)) {
      console.log('❌ OTP expired for institute:', instituteId);
      await pool.query('DELETE FROM password_reset_tokens WHERE institute_id = $1', [instituteId]);
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP matches
    if (storedOtp !== otp.trim()) {
      console.log('❌ Invalid OTP for institute:', instituteId);
      return res.status(401).json({ message: 'Invalid OTP. Please check and try again.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(trimmedPassword, salt);

    // Update password
    await pool.query(
      'UPDATE institutes SET password = $1 WHERE id = $2',
      [hashedPassword, instituteId]
    );

    console.log('✅ Password updated for institute:', instituteId);

    // Clear the OTP
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE institute_id = $1',
      [instituteId]
    );

    console.log('✅ OTP cleared for institute:', instituteId);

    res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({ message: 'Server error during password reset: ' + error.message });
  }
};

// Verify OTP only (without password reset)
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('🔐 OTP verification initiated');

    // Validation
    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      return res.status(400).json({ message: 'OTP must be exactly 6 digits' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if institute exists
    const instituteResult = await pool.query(
      'SELECT id FROM institutes WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (instituteResult.rows.length === 0) {
      console.log('❌ Institute not found for email:', normalizedEmail);
      return res.status(404).json({ message: 'Institute not found with this email' });
    }

    const instituteId = instituteResult.rows[0].id;

    // Check OTP
    const tokenResult = await pool.query(
      `SELECT otp, otp_expiry FROM password_reset_tokens 
       WHERE institute_id = $1`,
      [instituteId]
    );

    if (tokenResult.rows.length === 0) {
      console.log('❌ No OTP record found for institute:', instituteId);
      return res.status(401).json({ message: 'No OTP record found. Please request a new OTP.' });
    }

    const { otp: storedOtp, otp_expiry } = tokenResult.rows[0];

    // Check if OTP is expired
    if (new Date() > new Date(otp_expiry)) {
      console.log('❌ OTP expired for institute:', instituteId);
      await pool.query('DELETE FROM password_reset_tokens WHERE institute_id = $1', [instituteId]);
      return res.status(401).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP matches
    if (storedOtp !== otp.trim()) {
      console.log('❌ Invalid OTP for institute:', instituteId);
      return res.status(401).json({ message: '❌ Incorrect OTP. Please check and try again.' });
    }

    console.log('✅ OTP verified successfully for institute:', instituteId);

    res.status(200).json({
      message: 'OTP verified successfully',
      verified: true,
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({ message: 'Server error during OTP verification: ' + error.message });
  }
};

// Get Institute Details by Email (for password reset verification)
const getInstituteByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch institute details
    const result = await pool.query(
      `SELECT id, institute_name, principal_name, logo_url, email 
       FROM institutes 
       WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No institute found with this email' });
    }

    const institute = result.rows[0];

    res.status(200).json({
      message: 'Institute details retrieved',
      institute: {
        id: institute.id,
        institute_name: institute.institute_name,
        principal_name: institute.principal_name,
        logo_url: institute.logo_url,
        email: institute.email,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching institute details:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};