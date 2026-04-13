import db from '../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const updateDefaultSubscriptionPrice = async () => {
    try {
        console.log('🚀 Starting migration: Update default subscription price to 1499...');

        // 1. Update existing records that are using the old default
        const updateRecordsQuery = `
            UPDATE subscription_settings 
            SET monthly_price = 1499.00 
            WHERE monthly_price = 499.00;
        `;
        const updateRes = await db.query(updateRecordsQuery);
        console.log(`✅ Updated ${updateRes.rowCount} existing records to 1499.00`);

        // 2. Alter table to change the default value for future records
        const alterTableQuery = `
            ALTER TABLE subscription_settings 
            ALTER COLUMN monthly_price SET DEFAULT 1499.00;
        `;
        await db.query(alterTableQuery);
        console.log('✅ Changed table default value to 1499.00');

        console.log('✨ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

updateDefaultSubscriptionPrice();
