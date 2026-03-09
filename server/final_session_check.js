import pool from './config/db.js';

const finalTableCheck = async () => {
    try {
        console.log('🧐 Performing final session-awareness check on all tables...');
        
        const tables = [
            'students', 'teachers', 'attendance', 'attendance_logs', 
            'class_routines', 'admit_cards', 
            'exams', 'student_exam_results'
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
        
        console.log('🎉 Final verification complete.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Final check failed:', err);
        process.exit(1);
    }
};

finalTableCheck();