import pool from './config/db.js';
import bcrypt from 'bcryptjs';

const createAdminTable = async () => {
    try {
        // Create admins table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT 'Admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        console.log('Admins table created successfully');

        // Check if default admin exists
        const existingAdmin = await pool.query(
            'SELECT * FROM admins WHERE email = $1',
            ['admin@klassin2023.com']
        );

        if (existingAdmin.rows.length === 0) {
            // Create default admin with hashed password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Atul1234567890', salt);

            await pool.query(
                'INSERT INTO admins (email, password, name) VALUES ($1, $2, $3)',
                ['admin@klassin2023.com', hashedPassword, 'Super Admin']
            );

            console.log('Default admin created successfully');
            console.log('Email: admin@klassin2023.com');
            console.log('Password: Atul1234567890');
        } else {
            console.log('Default admin already exists');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin table:', error);
        process.exit(1);
    }
};

createAdminTable();
