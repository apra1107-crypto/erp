import db from '../config/db.js';
import { emitToPrincipal, emitToAdmin } from '../utils/socket.js';

// Get subscription settings for an institute
export const getSubscriptionSettings = async (req, res) => {
    try {
        const { instituteId } = req.params;

        const query = `
            SELECT * FROM subscription_settings 
            WHERE institute_id = $1
        `;

        const result = await db.query(query, [instituteId]);

        if (result.rows.length === 0) {
            // Create default settings if not exists
            const createQuery = `
                INSERT INTO subscription_settings (institute_id, monthly_price)
                VALUES ($1, 499.00)
                RETURNING *
            `;
            const createResult = await db.query(createQuery, [instituteId]);
            return res.json(createResult.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching subscription settings:', error);
        res.status(500).json({ error: 'Failed to fetch subscription settings' });
    }
};

export const updateSubscriptionSettings = async (req, res) => {
    try {
        const { instituteId } = req.params;
        const { monthly_price, override_access } = req.body;

        // Get current settings for logging
        const currentResult = await db.query('SELECT * FROM subscription_settings WHERE institute_id = $1', [instituteId]);
        const current = currentResult.rows[0];

        const query = `
            INSERT INTO subscription_settings (institute_id, monthly_price, override_access)
            VALUES ($1, $2, $3)
            ON CONFLICT (institute_id) 
            DO UPDATE SET 
                monthly_price = $2,
                override_access = $3,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await db.query(query, [instituteId, monthly_price, override_access]);

        // Logging Logic
        if (current) {
            if (parseFloat(current.monthly_price) !== parseFloat(monthly_price)) {
                await db.query('INSERT INTO subscription_logs (institute_id, action_type, details) VALUES ($1, $2, $3)',
                    [instituteId, 'PRICE_CHANGE', `Price changed from ₹${current.monthly_price} to ₹${monthly_price}`]);
            }
            if (current.override_access !== override_access) {
                await db.query('INSERT INTO subscription_logs (institute_id, action_type, details) VALUES ($1, $2, $3)',
                    [instituteId, 'ADMIN_OVERRIDE', `Special Access ${override_access ? 'GRANTED' : 'REVOKED'} by Admin`]);
            }
        } else {
            await db.query('INSERT INTO subscription_logs (institute_id, action_type, details) VALUES ($1, $2, $3)',
                [instituteId, 'INITIAL_SETUP', 'Profile initialized with custom settings']);
        }

        const newSettings = result.rows[0];
        let status = 'expired';
        const now = new Date();
        const expiry = newSettings.subscription_end_date ? new Date(newSettings.subscription_end_date) : null;

        if (expiry && now < expiry) status = 'active';
        else if (newSettings.override_access) status = 'grant';

        res.json({
            success: true,
            message: 'Subscription settings updated successfully',
            data: newSettings
        });

        // Emit Socket Event for real-time update on Principal Dashboard & Subscription Page
        emitToPrincipal(instituteId, 'subscription_update', {
            settings: newSettings,
            status: status
        });

        // Also notify teachers so their dashboards can lock/unlock
        emitToTeacher(instituteId, 'subscription_update', {
            settings: newSettings,
            status: status
        });
    } catch (error) {
        console.error('Error updating subscription settings:', error);
        res.status(500).json({ error: 'Failed to update subscription settings' });
    }
};

// Get subscription logs
export const getSubscriptionLogs = async (req, res) => {
    try {
        const { instituteId } = req.params;
        const query = `
            SELECT * FROM subscription_logs 
            WHERE institute_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50
        `;
        const result = await db.query(query, [instituteId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subscription logs:', error);
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
};

// Check if institute has active subscription
export const checkSubscriptionStatus = async (req, res) => {
    try {
        const { instituteId } = req.params;

        const query = `
            SELECT 
                ss.*,
                i.created_at as institute_created_at,
                CASE 
                    WHEN i.is_active = FALSE THEN 'disabled'
                    WHEN ss.subscription_end_date >= CURRENT_TIMESTAMP THEN 'active'
                    WHEN ss.override_access = TRUE THEN 'grant'
                    ELSE 'expired'
                END as status
            FROM subscription_settings ss
            JOIN institutes i ON i.id = ss.institute_id
            WHERE ss.institute_id = $1
        `;

        const result = await db.query(query, [instituteId]);

        if (result.rows.length === 0) {
            // Create default settings
            const createQuery = `
                INSERT INTO subscription_settings 
                (institute_id, monthly_price)
                VALUES ($1, 499.00)
                RETURNING *, 'expired' as status
            `;

            const createResult = await db.query(createQuery, [instituteId]);
            return res.json(createResult.rows[0]);
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({ error: 'Failed to check subscription status' });
    }
};

// Process payment and extend subscription
export const processPayment = async (req, res) => {
    try {
        const { instituteId } = req.params;
        const { months, amount } = req.body;

        // Get current subscription status
        const currentRes = await db.query('SELECT subscription_end_date FROM subscription_settings WHERE institute_id = $1', [instituteId]);

        let startDate = new Date();
        if (currentRes.rows.length > 0 && currentRes.rows[0].subscription_end_date) {
            const existingEnd = new Date(currentRes.rows[0].subscription_end_date);
            if (existingEnd > startDate) {
                startDate = existingEnd;
            }
        }

        const newEndDate = new Date(startDate);
        // FOR TESTING: 1 month = 1 minute
        newEndDate.setMinutes(newEndDate.getMinutes() + parseInt(months));

        const query = `
            UPDATE subscription_settings 
            SET 
                subscription_end_date = $1,
                last_payment_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE institute_id = $2
            RETURNING *
        `;

        const result = await db.query(query, [newEndDate, instituteId]);

        // Log payment
        await db.query('INSERT INTO subscription_logs (institute_id, action_type, details, amount) VALUES ($1, $2, $3, $4)',
            [instituteId, 'PAYMENT', `Subscription extended by ${months} months`, amount]);

        res.json({
            success: true,
            message: 'Payment processed successfully',
            data: result.rows[0]
        });

        // Notify Admin Dashboard
        emitToAdmin('payment_received', {
            instituteId,
            amount,
            subscription_end_date: result.rows[0].subscription_end_date
        });

        // Refresh Principal status
        emitToPrincipal(instituteId, 'subscription_update', {
            settings: result.rows[0],
            status: 'active'
        });

        // Also notify teachers so their dashboards can unlock
        emitToTeacher(instituteId, 'subscription_update', {
            settings: result.rows[0],
            status: 'active'
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
};
