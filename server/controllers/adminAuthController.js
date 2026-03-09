import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import fs from 'fs';
import path from 'path';

// Login Admin
const loginAdmin = async (req, res) => {
    console.log('--- ADMIN LOGIN ENDPOINT HIT ---');
    try {
        let { email, password } = req.body;
        const logPath = path.join(process.cwd(), 'admin_login_debug.log');
        const timestamp = new Date().toISOString();

        fs.appendFileSync(logPath, `\n[${timestamp}] Admin Login Attempt: email="${email}", passLen=${password?.length}\n`);

        // Validation
        if (!email || !password) {
            fs.appendFileSync(logPath, `[${timestamp}] Failed: Missing email or password\n`);
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        // Normalize
        email = email.trim().toLowerCase();
        password = password.trim();

        // Check if admin exists
        const result = await pool.query(
            'SELECT * FROM admins WHERE LOWER(email) = $1 AND is_active = true',
            [email]
        );

        if (result.rows.length === 0) {
            fs.appendFileSync(logPath, `[${timestamp}] Failed: Admin not found with email "${email}"\n`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);

        if (!isPasswordValid) {
            fs.appendFileSync(logPath, `[${timestamp}] Failed: Password mismatch for "${email}"\n`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        fs.appendFileSync(logPath, `[${timestamp}] Success: Admin logged in as "${email}"\n`);

        // Generate JWT token
        const token = jwt.sign(
            {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: 'admin',
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        // Remove password from response
        delete admin.password;

        res.status(200).json({
            message: 'Login successful',
            token,
            admin,
        });
    } catch (error) {
        console.error('Admin login error:', error);
        const logPath = path.join(process.cwd(), 'admin_login_debug.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] Error: ${error.message}\n`);
        res.status(500).json({ message: 'Server error during login' });
    }
};

export { loginAdmin };
