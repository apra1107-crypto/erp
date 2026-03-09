import pool from './config/db.js';

const migrateAdmissionDate = async () => {
    try {
        console.log('Adding admission_date to students table...');
        
        // 1. Add column if not exists
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS admission_date DATE;
        `);

        // 2. Update existing students to have admission_date = created_at
        await pool.query(`
            UPDATE students 
            SET admission_date = created_at::date 
            WHERE admission_date IS NULL;
        `);

        // 3. Set NOT NULL constraint after populating
        await pool.query(`
            ALTER TABLE students 
            ALTER COLUMN admission_date SET NOT NULL;
        `);

        console.log('✅ Admission date migration successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrateAdmissionDate();
