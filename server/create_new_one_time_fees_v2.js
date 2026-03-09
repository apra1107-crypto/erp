import pool from './config/db.js';

async function createNewOneTimeFeeTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Groups Table (The campaign)
        // Store which classes are involved and basic metadata
        await client.query(`
            CREATE TABLE IF NOT EXISTS one_time_fee_groups (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
                session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
                reason VARCHAR(255) NOT NULL,
                classes TEXT[] NOT NULL, -- Array of class names
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Class Configurations Table
        // Store the base amount for each class in a group
        await client.query(`
            CREATE TABLE IF NOT EXISTS one_time_fee_class_configs (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES one_time_fee_groups(id) ON DELETE CASCADE,
                class_name VARCHAR(50) NOT NULL,
                base_amount DECIMAL(10, 2) NOT NULL,
                UNIQUE(group_id, class_name)
            );
        `);

        // 3. Individual Payments Table (The Ledger)
        // Tracks each student's specific debt and payment history
        await client.query(`
            CREATE TABLE IF NOT EXISTS one_time_fee_payments (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES one_time_fee_groups(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                due_amount DECIMAL(10, 2) NOT NULL, -- Can be overridden from base_amount
                paid_amount DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes for faster lookups
        await client.query('CREATE INDEX IF NOT EXISTS idx_ot_payments_group ON one_time_fee_payments(group_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_ot_payments_student ON one_time_fee_payments(student_id)');

        await client.query('COMMIT');
        console.log('✅ New One-Time Fee tables and indexes created successfully');
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating new tables:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

createNewOneTimeFeeTables();
