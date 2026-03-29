
import { Expo } from 'expo-server-sdk';
import pool from '../config/db.js';

const expo = new Expo();

/**
 * PRODUCTION READY PUSH FLOW:
 * 1. Bulk Sending with Chunking
 * 2. Ticket Logging (for receipt checking)
 * 3. Automatic Invalid Token Removal
 */

export const sendMulticastPushNotification = async (messages) => {
    if (!messages || messages.length === 0) return [];

    console.log(`[Push] Batch sending ${messages.length} notifications.`);
    
    // Ensure channelId is set for Android (Crucial for Banners)
    messages.forEach(msg => {
        if (!msg.channelId) msg.channelId = 'klassin-alerts-v3';
        if (!msg.sound) msg.sound = 'default';
        if (!msg.priority) msg.priority = 'high';
    });

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];

    for (let chunk of chunks) {
        try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            
            tickets.push(...ticketChunk);

            // Log tickets to DB in background (Don't block the caller)
            (async () => {
                try {
                    const savePromises = ticketChunk.map((ticket, index) => {
                        if (ticket.status === 'ok') {
                            return pool.query(
                                'INSERT INTO push_notification_receipts (ticket_id, push_token, student_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                                [ticket.id, chunk[index].to, chunk[index].data?.student_id]
                            );
                        }
                        return null;
                    }).filter(p => p !== null);
                    await Promise.allSettled(savePromises);
                } catch (e) {
                    console.error('[Push] Receipt Log Background Error:', e);
                }
            })();
        } catch (error) {
            console.error('[Push] Fatal Chunk Error:', error);
        }
    }

    return tickets;
};

/**
 * PRODUCTION STEP 2: Receipt Checking Job
 * This should run every 15-30 minutes via cron.
 * It checks if notifications were actually delivered and cleans up dead tokens.
 */
export const checkPushReceipts = async () => {
    try {
        // Fetch pending tickets older than 15 mins (Expo takes time to generate receipts)
        const pendingRes = await pool.query(
            "SELECT id, ticket_id, push_token FROM push_notification_receipts WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes' LIMIT 500"
        );

        if (pendingRes.rows.length === 0) return;

        let ticketIds = pendingRes.rows.map(r => r.ticket_id);
        let receiptIdMap = {};
        pendingRes.rows.forEach(r => { receiptIdMap[r.ticket_id] = r; });

        let chunks = expo.chunkPushNotificationReceiptIds(ticketIds);

        for (let chunk of chunks) {
            let receipts = await expo.getPushNotificationReceiptsAsync(chunk);

            for (let ticketId in receipts) {
                let receipt = receipts[ticketId];
                let originalData = receiptIdMap[ticketId];

                if (receipt.status === 'ok') {
                    await pool.query('UPDATE push_notification_receipts SET status = $1, checked_at = NOW() WHERE ticket_id = $2', ['ok', ticketId]);
                } else if (receipt.status === 'error') {
                    console.error(`[Push] Delivery Error for ${originalData.push_token}: ${receipt.details?.error}`);
                    
                    // IF TOKEN IS DEAD, REMOVE FROM DB
                    if (receipt.details?.error === 'DeviceNotRegistered') {
                        console.warn(`[Push] Removing invalid token: ${originalData.push_token}`);
                        await pool.query('UPDATE students SET push_token = NULL WHERE push_token = $1', [originalData.push_token]);
                        await pool.query('UPDATE teachers SET push_token = NULL WHERE push_token = $1', [originalData.push_token]);
                        await pool.query('UPDATE institutes SET push_token = NULL WHERE push_token = $1', [originalData.push_token]);
                    }

                    await pool.query(
                        'UPDATE push_notification_receipts SET status = $1, error_message = $2, checked_at = NOW() WHERE ticket_id = $3',
                        ['error', receipt.details?.error, ticketId]
                    );
                }
            }
        }

        // Cleanup: Delete old processed receipts (keep for 2 days for debugging)
        await pool.query("DELETE FROM push_notification_receipts WHERE checked_at < NOW() - INTERVAL '2 days'");

    } catch (error) {
        console.error('[Push] Receipt Job Error:', error);
    }
};

// Start the background worker (Run every 30 mins)
setInterval(checkPushReceipts, 30 * 60 * 1000);

/**
 * Broadcasts a notification to all students, teachers, and the principal of a specific institute.
 */
export const broadcastInstituteNotification = async (instituteId, title, body, data = {}) => {
    try {
        console.log(`[Broadcast] Starting broadcast for institute ${instituteId}: ${title}`);
        
        // 1. Fetch Principal Token
        const principalRes = await pool.query('SELECT push_token FROM institutes WHERE id = $1', [instituteId]);
        
        // 2. Fetch All Teachers' Tokens
        const teachersRes = await pool.query(
            'SELECT push_token FROM teachers WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != $2', 
            [instituteId, '']
        );

        // 3. Fetch All Students' Tokens
        const studentsRes = await pool.query(
            'SELECT push_token FROM students WHERE institute_id = $1 AND push_token IS NOT NULL AND push_token != $2', 
            [instituteId, '']
        );

        const allTokens = [];
        if (principalRes.rows[0]?.push_token) allTokens.push(principalRes.rows[0].push_token);
        
        teachersRes.rows.forEach(t => {
            if (t.push_token) allTokens.push(t.push_token);
        });

        studentsRes.rows.forEach(s => {
            if (s.push_token) allTokens.push(s.push_token);
        });

        const uniqueTokens = [...new Set(allTokens)];

        if (uniqueTokens.length > 0) {
            console.log(`[Broadcast] Sending to ${uniqueTokens.length} unique tokens.`);
            return await sendPushNotification(uniqueTokens, title, body, data);
        } else {
            console.log(`[Broadcast] No push tokens found for institute ${instituteId}`);
            return [];
        }
    } catch (error) {
        console.error('Error in broadcastInstituteNotification:', error);
        return [];
    }
};

export const sendPushNotification = async (pushTokens, title, body, data = {}) => {
    const messages = pushTokens.map(token => ({
        to: token,
        title,
        body,
        data,
    }));
    return await sendMulticastPushNotification(messages);
};
