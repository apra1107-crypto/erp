import pool from '../config/db.js';

const migrate = async () => {
    try {
        console.log('Starting migration to add amount snapshots to student_fees...');

        // 1. Add columns to student_fees
        await pool.query(`
            ALTER TABLE student_fees 
            ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10, 2) DEFAULT 0
        `);
        console.log('Added amount columns to student_fees');

        // 2. BACKFILL: Update existing 'paid' records using the current student profile
        // This is a one-time operation to ensure historical data isn't lost
        await pool.query(`
            UPDATE student_fees f
            SET amount_paid = (s.monthly_fees + CASE WHEN s.transport_facility THEN s.transport_fees ELSE 0 END),
                amount_due = (s.monthly_fees + CASE WHEN s.transport_facility THEN s.transport_fees ELSE 0 END)
            FROM students s
            WHERE f.student_id = s.id AND f.status = 'paid' AND f.amount_paid = 0
        `);
        console.log('Backfilled existing paid records');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();