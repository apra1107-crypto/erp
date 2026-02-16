import pool from './config/db.js';

const migrateTables = async () => {
    try {
        console.log('🚀 Starting Phase 2 Migration: Adding session_id to tables...');

        // List of tables that need to be Session-Scoped
        const tables = [
            'students',
            'attendance',
            'attendance_logs',
            'class_routines',
            'admit_cards',
        ];

        // 1. Get the Default Session ID for each institute
        const institutes = await pool.query('SELECT id, current_session_id FROM institutes');
        const sessionMap = {};
        institutes.rows.forEach(inst => {
            if (inst.current_session_id) {
                sessionMap[inst.id] = inst.current_session_id;
            }
        });

        console.log(`ℹ️  Found ${Object.keys(sessionMap).length} institutes with active sessions.`);

        // 2. Add session_id column and migrate data
        for (const table of tables) {
            // Check if column exists
            const colCheck = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = '${table}' AND column_name = 'session_id'
            `);

            if (colCheck.rows.length === 0) {
                console.log(`⚡ Adding session_id to ${table}...`);
                
                // Add the column
                await pool.query(`ALTER TABLE ${table} ADD COLUMN session_id INTEGER`);

                // Add Foreign Key constraint
                await pool.query(`
                    ALTER TABLE ${table} 
                    ADD CONSTRAINT fk_${table}_session 
                    FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
                `);

                // UPDATE existing rows
                for (const [instId, sessionId] of Object.entries(sessionMap)) {
                    await pool.query(`
                        UPDATE ${table} 
                        SET session_id = $1 
                        WHERE institute_id = $2 AND session_id IS NULL
                    `, [sessionId, instId]);
                }

                console.log(`✅ Migrated data for ${table}`);
            } else {
                console.log(`⚠️  ${table} already has session_id.`);
            }
        }

        // 3. Special handling for Fees tables
        const feeTables = ['fees', 'occasional_fees', 'fee_receipts'];
        
        for (const table of feeTables) {
             const tableExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '${table}'
                );
            `);

            if (tableExists.rows[0].exists) {
                const colCheck = await pool.query(`
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = '${table}' AND column_name = 'session_id'
                `);

                if (colCheck.rows.length === 0) {
                     console.log(`⚡ Adding session_id to ${table}...`);
                     await pool.query(`ALTER TABLE ${table} ADD COLUMN session_id INTEGER`);
                     await pool.query(`
                        ALTER TABLE ${table} 
                        ADD CONSTRAINT fk_${table}_session 
                        FOREIGN KEY (session_id) REFERENCES academic_sessions(id)
                    `);

                    for (const [instId, sessionId] of Object.entries(sessionMap)) {
                        await pool.query(`
                            UPDATE ${table} 
                            SET session_id = $1 
                            WHERE institute_id = $2 AND session_id IS NULL
                        `, [sessionId, instId]);
                    }
                    console.log(`✅ Migrated data for ${table}`);
                }
            }
        }

        console.log('🎉 Phase 2 Migration Complete!');
        process.exit(0);

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrateTables();