
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
    console.log('Creating bank_accounts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id SERIAL PRIMARY KEY,
        institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
        account_holder_name VARCHAR(255) NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        ifsc_code VARCHAR(20) NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Move existing data from institutes table if any
    const existing = await pool.query("SELECT id, bank_name, account_number, ifsc_code, account_holder_name FROM institutes WHERE bank_name IS NOT NULL AND bank_name != ''");
    
    for (const inst of existing.rows) {
        // Check if already moved
        const check = await pool.query("SELECT id FROM bank_accounts WHERE institute_id = $1 AND account_number = $2", [inst.id, inst.account_number]);
        if (check.rows.length === 0) {
            console.log(`Moving bank details for institute ${inst.id}...`);
            await pool.query(
                "INSERT INTO bank_accounts (institute_id, bank_name, account_number, ifsc_code, account_holder_name, is_primary) VALUES ($1, $2, $3, $4, $5, true)",
                [inst.id, inst.bank_name, inst.account_number, inst.ifsc_code, inst.account_holder_name]
            );
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
