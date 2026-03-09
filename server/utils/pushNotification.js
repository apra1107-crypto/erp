import { Expo } from 'expo-server-sdk';
import pool from '../config/db.js';

const expo = new Expo();

export const sendPushNotification = async (pushTokens, title, body, data = {}) => {
    console.log(`[Push] Attempting to send to ${pushTokens.length} tokens. Title: ${title}`);
    let messages = [];
    for (let pushToken of pushTokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
            console.error(`[Push] Invalid Expo push token: ${pushToken}`);
            continue;
        }

        messages.push({
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
            channelId: 'klassin-alerts-v2',
        });
    }

    if (messages.length === 0) {
        console.log('[Push] No valid messages to send.');
        return [];
    }

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    
    console.log(`[Push] Split into ${chunks.length} chunks`);

    for (let chunk of chunks) {
        try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log(`[Push] Chunk sent successfully. Tickets: ${ticketChunk.length}`);
            tickets.push(...ticketChunk);
        } catch (error) {
            console.error('[Push] Error sending push notification chunk:', error);
        }
    }

    return tickets;
};

/**
 * Sends multiple personalized messages efficiently.
 * @param {Array} messages - Array of message objects { to, title, body, data, ... }
 */
export const sendMulticastPushNotification = async (messages) => {
    if (!messages || messages.length === 0) return [];

    console.log(`[Push] Sending ${messages.length} multicast messages.`);
    
    // Ensure channelId is set for Android
    messages.forEach(msg => {
        if (!msg.channelId) msg.channelId = 'klassin-alerts-v2';
        if (!msg.sound) msg.sound = 'default';
        if (!msg.priority) msg.priority = 'high';
    });

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];

    for (let chunk of chunks) {
        try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log(`[Push] Multicast chunk sent. Tickets: ${ticketChunk.length}`);
            tickets.push(...ticketChunk);
        } catch (error) {
            console.error('[Push] Error sending multicast chunk:', error);
        }
    }

    return tickets;
};

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