import pool from './config/db.js';

const setupSessions = async () => {
    try {
        // 1. Create academic_sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS academic_sessions (
                id SERIAL PRIMARY KEY,
                institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
                name VARCHAR(50) NOT NULL,
                start_date DATE,
                end_date DATE,
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(institute_id, name)
            );
        `);
        console.log('✅ academic_sessions table created');

        // 2. Add current_session_id to institutes table
        // We check if it exists first to be safe
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'institutes' AND column_name = 'current_session_id';
        `);

        if (columnCheck.rows.length === 0) {
            await pool.query(`
                ALTER TABLE institutes 
                ADD COLUMN current_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL;
            `);
            console.log('✅ current_session_id added to institutes');
        }

        // 3. For every existing institute, create a "Default Session" if they don't have one
        const institutes = await pool.query('SELECT id, institute_name FROM institutes');
        
        for (const inst of institutes.rows) {
            // Check if they already have a session
            const sessionCheck = await pool.query(
                'SELECT id FROM academic_sessions WHERE institute_id = $1',
                [inst.id]
            );

            if (sessionCheck.rows.length === 0) {
                // Create a default session
                const newSession = await pool.query(
                    'INSERT INTO academic_sessions (institute_id, name, is_active) VALUES ($1, $2, $3) RETURNING id',
                    [inst.id, 'Current Session', true]
                );

                // Update institute to point to this session
                await pool.query(
                    'UPDATE institutes SET current_session_id = $1 WHERE id = $2',
                    [newSession.rows[0].id, inst.id]
                );
                console.log(`✅ Default session created for institute: ${inst.institute_name}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

setupSessions();
