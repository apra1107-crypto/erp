import db from '../config/db.js';

const addOverrideColumn = async () => {
    try {
        console.log('🚀 Adding override_access column...');

        const query = `
            ALTER TABLE subscription_settings 
            ADD COLUMN IF NOT EXISTS override_access BOOLEAN DEFAULT FALSE;
        `;

        await db.query(query);
        console.log('✅ Column override_access added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding column:', error);
        process.exit(1);
    }
};

addOverrideColumn();
