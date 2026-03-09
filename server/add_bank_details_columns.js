
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'school_erp',
  password: 'Atul123',
  port: 5432,
});

async function migrate() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'institutes'");
    const columns = res.rows.map(r => r.column_name);
    console.log('Current columns:', columns);

    const neededColumns = [
      { name: 'bank_name', type: 'VARCHAR(255)' },
      { name: 'account_number', type: 'VARCHAR(50)' },
      { name: 'ifsc_code', type: 'VARCHAR(20)' },
      { name: 'account_holder_name', type: 'VARCHAR(255)' }
    ];

    for (const col of neededColumns) {
      if (!columns.includes(col.name)) {
        console.log(`Adding column ${col.name}...`);
        await pool.query(`ALTER TABLE institutes ADD COLUMN ${col.name} ${col.type}`);
      } else {
        console.log(`Column ${col.name} already exists.`);
      }
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
