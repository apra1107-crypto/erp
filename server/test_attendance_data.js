import pool from './config/db.js';

const testAttendance = async () => {
    try {
        // Get a student
        const studentResult = await pool.query('SELECT id, name FROM students LIMIT 1');
        if (studentResult.rows.length === 0) {
            console.log('❌ No students in database');
            process.exit(0);
        }

        const student = studentResult.rows[0];
        console.log('\n📌 Testing for student:', student.name, '(ID:', student.id, ')');

        // Check all attendance for this student
        const allAttendance = await pool.query(
            'SELECT id, date, status, teacher_id, class, section FROM attendance WHERE student_id = $1 ORDER BY date DESC',
            [student.id]
        );

        console.log('\n✅ Total attendance records found:', allAttendance.rows.length);
        if (allAttendance.rows.length > 0) {
            console.log('\nFirst 5 records:');
            allAttendance.rows.slice(0, 5).forEach(row => {
                console.log(`  - Date: ${row.date}, Status: ${row.status}, Teacher ID: ${row.teacher_id}`);
            });

            // Test the query for February 2026
            const feb2026Start = '2026-02-01';
            const feb2026End = '2026-02-28';
            
            const februaryAttendance = await pool.query(
                `SELECT a.id, a.date::TEXT, a.status, a.class, a.section, a.teacher_id,
                        COALESCE(t.name, 'Principal') as marked_by,
                        a.updated_at
                 FROM attendance a
                 LEFT JOIN teachers t ON a.teacher_id = t.id
                 WHERE a.student_id = $1 AND a.date >= $2 AND a.date <= $3
                 ORDER BY a.date DESC`,
                [student.id, feb2026Start, feb2026End]
            );

            console.log('\n📅 Attendance in February 2026:', februaryAttendance.rows.length);
            if (februaryAttendance.rows.length > 0) {
                console.log('\nRecords for February 2026:');
                februaryAttendance.rows.forEach(row => {
                    console.log(`  - Date: ${row.date}, Status: ${row.status}, Marked by: ${row.marked_by}`);
                });
            } else {
                console.log('  ❌ No attendance records found for February 2026');
                console.log('  📊 Checking what dates exist in the database...');
                
                const dateRange = await pool.query(
                    'SELECT DISTINCT DATE_TRUNC(\'month\', date) as month FROM attendance WHERE student_id = $1 ORDER BY month DESC LIMIT 5',
                    [student.id]
                );
                console.log('  Available months:', dateRange.rows.map(r => r.month?.toISOString().split('T')[0]));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

testAttendance();
