import db from '../config/db.js';

const createSubscriptionLogsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS subscription_logs (
            id SERIAL PRIMARY KEY,
            institute_id INTEGER NOT NULL,
            action_type VARCHAR(50) NOT NULL, -- 'PAYMENT', 'STATUS_CHANGE', 'TRIAL_ACTIVATION', 'PRICE_CHANGE'
            details TEXT,
            amount DECIMAL(10, 2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
        )
    `;

    try {
        await db.query(createTableQuery);
        console.log('✅ subscription_logs table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating subscription_logs table:', error);
        process.exit(1);
    }
};

createSubscriptionLogsTable();
