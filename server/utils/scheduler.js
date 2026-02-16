import cron from 'node-cron';
import pool from '../config/db.js';
import { broadcastInstituteNotification } from './pushNotification.js';
import { emitToPrincipal, emitToTeacher, emitToAllStudents } from './socket.js';

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

export const startScheduler = () => {
    // Run every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        await triggerDailyEvents();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('⏰ Scheduler initialized (Daily at 8:00 AM IST)');
};
