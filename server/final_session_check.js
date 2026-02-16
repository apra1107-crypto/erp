import pool from './config/db.js';

const finalTableCheck = async () => {
    try {
        console.log('🧐 Performing final session-awareness check on all tables...');
        
        const tables = [
            'students', 'teachers', 'attendance', 'attendance_logs', 
            'class_routines', 'admit_cards', 
            'exams', 'student_exam_results', 'fee_configurations', 
            'student_monthly_fees', 'student_occasional_fees'
        ];

        for (const table of tables) {
            const tableExists = await pool.query(`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')
            `);
            if (!tableExists.rows[0].exists) continue;

            const res = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = '${table}' AND column_name = 'session_id'
            `);
            
            if (res.rows.length === 0) {
                console.log(`❌ Table ${table} is MISSING session_id! Fixing now...`);
                await pool.query(`ALTER TABLE ${table} ADD COLUMN session_id INTEGER REFERENCES academic_sessions(id)`);
                console.log(`✅ Fixed ${table}`);
            } else {
                console.log(`✅ Table ${table} is session-aware.`);
            }
        }

        console.log('\n🔐 Checking unique constraints...');
        
        const updateUq = async (table, cols) => {
            try {
                const nameQuery = await pool.query(`
                    SELECT conname FROM pg_constraint 
                    WHERE conrelid = '${table}'::regclass AND contype = 'u'
                `);
                if (nameQuery.rows.length > 0) {
                    for (const row of nameQuery.rows) {
                        await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT ${row.conname}`);
                    }
                }
                await pool.query(`ALTER TABLE ${table} ADD UNIQUE (${cols.join(', ')})`);
                console.log(`✅ Updated ${table} unique constraint to: ${cols.join(', ')}`);
            } catch (e) {
                console.warn(`⚠️ Could not update constraint for ${table}:`, e.message);
            }
        };

        await updateUq('fee_configurations', ['institute_id', 'month_year', 'session_id']);
        await updateUq('student_monthly_fees', ['student_id', 'month_year', 'session_id']);

        console.log('🎉 Final verification complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Final check failed:', err);
        process.exit(1);
    }
};

finalTableCheck();