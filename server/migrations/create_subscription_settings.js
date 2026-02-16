import db from '../config/db.js';

const createSubscriptionSettingsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS subscription_settings (
            id SERIAL PRIMARY KEY,
            institute_id INTEGER NOT NULL UNIQUE,
            monthly_price DECIMAL(10, 2) DEFAULT 499.00,
            trial_days INTEGER DEFAULT 14,
            is_active BOOLEAN DEFAULT TRUE,
            subscription_start_date DATE,
            subscription_end_date DATE,
            trial_end_date DATE,
            last_payment_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
        )
    `;

    try {
        await db.query(createTableQuery);
        console.log('✅ subscription_settings table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating subscription_settings table:', error);
        process.exit(1);
    }
};

createSubscriptionSettingsTable();
