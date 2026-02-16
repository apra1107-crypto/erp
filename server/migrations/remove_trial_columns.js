import db from '../config/db.js';

const removeTrialColumns = async () => {
    const alterTableQuery = `
        ALTER TABLE subscription_settings 
        DROP COLUMN IF EXISTS trial_days,
        DROP COLUMN IF EXISTS trial_end_date;
    `;

    try {
        await db.query(alterTableQuery);
        console.log('✅ Trial columns removed from subscription_settings table successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error removing trial columns:', error);
        process.exit(1);
    }
};

removeTrialColumns();
