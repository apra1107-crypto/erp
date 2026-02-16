import pool from './config/db.js';

const fixMissingSessionIds = async () => {
    try {
        console.log('⚡ Checking for institutes with missing current_session_id...');
        
        // Find institutes where current_session_id is NULL
        const result = await pool.query(`
            SELECT id, institute_name FROM institutes WHERE current_session_id IS NULL
        `);

        console.log(`ℹ️ Found ${result.rows.length} institutes with missing session ID.`);

        for (const inst of result.rows) {
            // Find an active session for this institute
            const sessionResult = await pool.query(`
                SELECT id FROM academic_sessions 
                WHERE institute_id = $1 AND is_active = true 
                LIMIT 1
            `, [inst.id]);

            if (sessionResult.rows.length > 0) {
                const sessionId = sessionResult.rows[0].id;
                await pool.query(`
                    UPDATE institutes SET current_session_id = $1 WHERE id = $2
                `, [sessionId, inst.id]);
                console.log(`✅ Fixed session for ${inst.institute_name} (ID: ${sessionId})`);
            } else {
                console.log(`⚠️ No active session found for ${inst.institute_name}. Creating one...`);
                const newSession = await pool.query(`
                    INSERT INTO academic_sessions (institute_id, name, is_active) 
                    VALUES ($1, 'Current Session', true) 
                    RETURNING id
                `, [inst.id]);
                
                await pool.query(`
                    UPDATE institutes SET current_session_id = $1 WHERE id = $2
                `, [newSession.rows[0].id, inst.id]);
                console.log(`✅ Created and linked new session for ${inst.institute_name}`);
            }
        }

        console.log('🎉 Done fixing session IDs.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fixing session IDs:', err);
        process.exit(1);
    }
};

fixMissingSessionIds();
