import db from '../config/db.js';
import { emitToPrincipal, emitToAdmin, emitToTeacher } from '../utils/socket.js';
import { sendWhatsAppMessage } from '../utils/whatsapp.js';
import { sendSubscriptionSuccessEmail } from '../utils/aws.js';

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

        const query = `
            INSERT INTO subscription_settings (institute_id, monthly_price, override_access, last_payment_date, last_action_details)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
            ON CONFLICT (institute_id) 
            DO UPDATE SET 
                monthly_price = $2,
                override_access = $3,
                last_payment_date = CURRENT_TIMESTAMP,
                last_action_details = $4,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const actionDetails = `Admin: ${override_access ? 'Special Access Granted' : 'Special Access Revoked'}`;
        const result = await db.query(query, [instituteId, monthly_price, override_access, actionDetails]);

        const newSettings = result.rows[0];
        let status = 'expired';
        const now = new Date();
        const expiry = newSettings.subscription_end_date ? new Date(newSettings.subscription_end_date) : null;

        if (newSettings.override_access) status = 'grant';
        else if (expiry && now < expiry) status = 'active';

        res.json({
            success: true,
            message: 'Subscription settings updated successfully',
            data: newSettings
        });

        // Emit Socket Event for real-time update
        emitToPrincipal(instituteId, 'subscription_update', {
            settings: newSettings,
            status: status
        });

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
                i.is_active as institute_is_active,
                i.created_at as institute_created_at,
                CASE 
                    WHEN i.is_active = FALSE THEN 'disabled'
                    WHEN ss.override_access = TRUE THEN 'grant'
                    WHEN ss.subscription_end_date >= CURRENT_TIMESTAMP THEN 'active'
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

        const currentRes = await db.query('SELECT subscription_end_date FROM subscription_settings WHERE institute_id = $1', [instituteId]);

        let startDateForCalc = new Date();
        if (currentRes.rows.length > 0 && currentRes.rows[0].subscription_end_date) {
            const existingEnd = new Date(currentRes.rows[0].subscription_end_date);
            if (existingEnd > startDateForCalc) {
                startDateForCalc = existingEnd;
            }
        }

        const newEndDate = new Date(startDateForCalc);
        const daysToAdd = parseInt(months) * 30;
        newEndDate.setDate(newEndDate.getDate() + daysToAdd);

        const query = `
            UPDATE subscription_settings 
            SET 
                subscription_end_date = $1,
                subscription_start_date = CURRENT_TIMESTAMP,
                last_payment_date = CURRENT_TIMESTAMP,
                last_action_details = $3,
                override_access = FALSE,
                updated_at = CURRENT_TIMESTAMP
            WHERE institute_id = $2
            RETURNING *
        `;

        const actionDetails = `Payment: ₹${Math.round(amount)} for ${daysToAdd} Days (${months} Month/s)`;
        const result = await db.query(query, [newEndDate, instituteId, actionDetails]);

        // Log payment
        await db.query('INSERT INTO subscription_logs (institute_id, action_type, details, amount) VALUES ($1, $2, $3, $4)',
            [instituteId, 'PAYMENT', actionDetails, amount]);

        // Get Principal details for WhatsApp & Email
        const instRes = await db.query('SELECT principal_name, mobile, email, institute_name FROM institutes WHERE id = $1', [instituteId]);
        if (instRes.rows.length > 0) {
            const { principal_name, mobile, email, institute_name } = instRes.rows[0];
            const newExpiry = new Date(result.rows[0].subscription_end_date).toLocaleDateString('en-IN');
            
            // Send WhatsApp
            sendWhatsAppMessage(mobile, 'payment_success_thanks', [
                principal_name,
                amount,
                institute_name,
                newExpiry
            ]).catch(err => console.error('Failed to send WhatsApp payment confirmation:', err));

            // Send Email
            sendSubscriptionSuccessEmail(email, principal_name, institute_name, {
                amount: amount,
                durationDays: daysToAdd,
                months: months,
                expiryDate: result.rows[0].subscription_end_date,
                transactionId: `SUB-${Date.now()}` // Generating a manual txn ID for internal payments
            }).catch(err => console.error('Failed to send subscription email:', err));
        }

        res.json({
            success: true,
            message: 'Payment processed successfully',
            data: result.rows[0]
        });

        // Notify Dashboards
        emitToAdmin('payment_received', {
            instituteId,
            amount,
            subscription_end_date: result.rows[0].subscription_end_date
        });

        emitToPrincipal(instituteId, 'subscription_update', {
            settings: result.rows[0],
            status: 'active'
        });

        emitToTeacher(instituteId, 'subscription_update', {
            settings: result.rows[0],
            status: 'active'
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
};