import pool from './config/db.js';

async function migrate() {
    console.log('--- Starting Teacher Session-Independence Migration ---');

    try {
        // 1. Get all teachers grouped by unique_code and institute_id (ignoring session_id)
        const groupsRes = await pool.query(`
            SELECT unique_code, institute_id, COUNT(*) as count, array_agg(id ORDER BY id ASC) as ids
            FROM teachers
            GROUP BY unique_code, institute_id
            HAVING COUNT(*) > 0
        `);

        console.log(`Found ${groupsRes.rows.length} teacher groups to process.`);

        for (const group of groupsRes.rows) {
            const { unique_code, ids } = group;
            const primaryId = ids[0];
            const duplicateIds = ids.slice(1);

            if (duplicateIds.length === 0) {
                console.log(`Teacher ${unique_code} has no duplicates. Skipping...`);
                continue;
            }

            console.log(`Processing Teacher ${unique_code}: Keeping ID ${primaryId}, Merging IDs: ${duplicateIds.join(', ')}`);

            // 2. Update referencing tables
            
            // teacher_self_attendance
            await pool.query(
                'UPDATE teacher_self_attendance SET teacher_id = $1 WHERE teacher_id = ANY($2)',
                [primaryId, duplicateIds]
            );

            // teacher_salaries
            await pool.query(
                'UPDATE teacher_salaries SET teacher_id = $1 WHERE teacher_id = ANY($2)',
                [primaryId, duplicateIds]
            );

            // attendance (the one who took the attendance)
            await pool.query(
                'UPDATE attendance SET teacher_id = $1 WHERE teacher_id = ANY($2)',
                [primaryId, duplicateIds]
            );

            // homework
            await pool.query(
                'UPDATE homework SET teacher_id = $1 WHERE teacher_id = ANY($2)',
                [primaryId, duplicateIds]
            );

            // admit_cards
            await pool.query(
                'UPDATE admit_cards SET teacher_id = $1 WHERE teacher_id = ANY($2)',
                [primaryId, duplicateIds]
            );

            // notices
            await pool.query(
                "UPDATE notices SET created_by_id = $1 WHERE created_by_id = ANY($2) AND created_by_role = 'teacher'",
                [primaryId, duplicateIds]
            );

            // 3. Update class_routines (JSON data)
            const routinesRes = await pool.query('SELECT id, data FROM class_routines');
            for (const routine of routinesRes.rows) {
                let changed = false;
                const data = routine.data;
                
                for (const day in data) {
                    if (Array.isArray(data[day])) {
                        data[day].forEach(slot => {
                            if (slot && slot.teacherId && duplicateIds.includes(parseInt(slot.teacherId))) {
                                slot.teacherId = primaryId.toString();
                                changed = true;
                            }
                        });
                    }
                }

                if (changed) {
                    await pool.query(
                        'UPDATE class_routines SET data = $1 WHERE id = $2',
                        [JSON.stringify(data), routine.id]
                    );
                }
            }

            // 4. Delete duplicates
            await pool.query(
                'DELETE FROM teachers WHERE id = ANY($1)',
                [duplicateIds]
            );
        }

        // 5. Finally, remove the session_id column from the teachers table
        // We do this in a separate query
        console.log('Dropping session_id column from teachers table...');
        await pool.query('ALTER TABLE teachers DROP COLUMN IF EXISTS session_id');

        console.log('--- Migration Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
