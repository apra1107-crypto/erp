import cron from 'node-cron';
import pool from '../config/db.js';
import { broadcastInstituteNotification } from './pushNotification.js';
import { emitToPrincipal, emitToTeacher, emitToAllStudents } from './socket.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { sendSubscriptionExpiredEmail } from './aws.js';

/**
 * Checks for academic calendar events scheduled for today and notifies everyone.
 */
export const triggerDailyEvents = async () => {
    console.log('[Scheduler] Checking daily academic calendar events...');
    try {
        // Use DB's interpretation of "today" in the local timezone (Asia/Kolkata)
        // This ensures the query matches the event_date column format exactly.
        const result = await pool.query(
            "SELECT id, institute_id, title, description, event_date::TEXT as event_date, event_type FROM academic_calendar WHERE event_date = CURRENT_DATE"
        );

        if (result.rows.length === 0) {
            console.log(`[Scheduler] No events found for today.`);
            return;
        }

        console.log(`[Scheduler] Found ${result.rows.length} event(s) for today.`);

        for (const event of result.rows) {
            const { institute_id, title, description, event_type } = event;
            const notificationTitle = `Today's Event: ${title}`;
            const notificationBody = description || `Check the academic calendar for more details.`;
            const data = { type: 'calendar_event', eventId: event.id, event_type };

            console.log(`[Scheduler] Notifying institute ${institute_id} about: ${title}`);

            // 1. Send Push Notifications to everyone in the institute
            await broadcastInstituteNotification(institute_id, notificationTitle, notificationBody, data);

            // 2. Emit Socket Events for real-time banner/notification on dashboard
            try {
                const socketData = { 
                    topic: title, 
                    creator_name: 'Academic Calendar', 
                    isUpdate: false,
                    type: 'notice' // Client listens for 'new_notice' and uses it for banner
                };
                
                emitToPrincipal(institute_id, 'new_notice', socketData);
                emitToTeacher(institute_id, 'new_notice', socketData);
                emitToAllStudents(institute_id, 'new_notice', socketData);
            } catch (socketError) {
                console.error('[Scheduler] Socket emit error:', socketError);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in triggerDailyEvents:', error);
    }
};

/**
 * Checks for subscription expirations and sends WhatsApp reminders.
 */
export const checkSubscriptionExpirations = async () => {
    console.log('[Scheduler] Checking subscription expirations...');
    try {
        // 1. Check for 1-day reminders
        const reminderResult = await pool.query(
            `SELECT i.mobile, i.principal_name, i.institute_name, ss.subscription_end_date 
             FROM subscription_settings ss 
             JOIN institutes i ON i.id = ss.institute_id 
             WHERE ss.subscription_end_date::date = (CURRENT_DATE + INTERVAL '1 day')::date`
        );

        for (const row of reminderResult.rows) {
            // template: sub_expiry_reminder body: "Urgent: Hello {{1}}, your subscription for {{2}} ends tomorrow. ⏳ To avoid any disruption in classes or management, please renew today. Click here to pay: {{3}}"
            sendWhatsAppMessage(row.mobile, 'sub_expiry_reminder', [
                row.principal_name,
                row.institute_name,
                'https://klassin.com/billing' // Assuming your URL
            ]).catch(err => console.error(`Failed to send 1-day expiry reminder to ${row.mobile}:`, err));
        }

        // 2. Check for already expired (e.g., expired today)
        const expiredResult = await pool.query(
            `SELECT i.mobile, i.email, i.principal_name, i.institute_name, ss.monthly_price, ss.subscription_end_date
             FROM subscription_settings ss 
             JOIN institutes i ON i.id = ss.institute_id 
             WHERE ss.subscription_end_date::date = CURRENT_DATE::date`
        );

        for (const row of expiredResult.rows) {
            // WhatsApp Notification
            sendWhatsAppMessage(row.mobile, 'sub_expired_request', [
                row.principal_name,
                row.institute_name,
                row.monthly_price
            ]).catch(err => console.error(`Failed to send expiry notification to ${row.mobile}:`, err));

            // Email Notification
            sendSubscriptionExpiredEmail(row.email, row.principal_name, row.institute_name, {
                expiryDate: row.subscription_end_date,
                monthlyPrice: row.monthly_price
            }).catch(err => console.error(`Failed to send expiry email to ${row.email}:`, err));
        }

        // 3. Optional: Add a 3-day reminder for better UX
        const threeDayReminder = await pool.query(
            `SELECT i.email, i.principal_name, i.institute_name, ss.subscription_end_date, ss.monthly_price
             FROM subscription_settings ss 
             JOIN institutes i ON i.id = ss.institute_id 
             WHERE ss.subscription_end_date::date = (CURRENT_DATE + INTERVAL '3 days')::date`
        );

        for (const row of threeDayReminder.rows) {
            // Using the expired template with modified subject/text or you can create a specific reminder one
            // For now, let's just use the expired one but it will show the future date correctly
            sendSubscriptionExpiredEmail(row.email, row.principal_name, row.institute_name, {
                expiryDate: row.subscription_end_date,
                monthlyPrice: row.monthly_price
            }).catch(err => console.error(`Failed to send 3-day reminder email to ${row.email}:`, err));
        }

    } catch (error) {
        console.error('[Scheduler] Error in checkSubscriptionExpirations:', error);
    }
};

export const startScheduler = () => {
    // Run daily events check every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        await triggerDailyEvents();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    // Run subscription check every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        await checkSubscriptionExpirations();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('⏰ Scheduler initialized (Events at 8AM, Subscriptions at 9AM IST)');
};

