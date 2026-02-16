import pool from './config/db.js';

const checkSchema = async () => {
    try {
        const res1 = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'institutes';"
        );
        console.log('Institutes Table Columns:', res1.rows.map(r => r.column_name));

        const res2 = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'principals';"
        );
        console.log('Principals Table Columns:', res2.rows.map(r => r.column_name));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkSchema();
