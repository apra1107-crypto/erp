import pool from './config/db.js';

async function checkIds() {
    try {
        const t = await pool.query("SELECT id FROM teachers LIMIT 1");
        const i = await pool.query("SELECT id FROM institutes LIMIT 1");
        
        console.log('Teacher ID type:', typeof t.rows[0]?.id, t.rows[0]?.id);
        console.log('Institute ID type:', typeof i.rows[0]?.id, i.rows[0]?.id);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkIds();
