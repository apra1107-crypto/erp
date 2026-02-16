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
 * Sends a notification to the Principal and Teachers with special_permission
 * whenever a student pays their fees online.
 */
export const notifyFeePayment = async (studentId, instituteId, amount, feeType) => {
    try {
        // 1. Get Student Details
        const studentRes = await pool.query('SELECT name, class, section, roll_no FROM students WHERE id = $1', [studentId]);
        const student = studentRes.rows[0];

        if (!student) return;

        // 2. Fetch Principal Token
        const principalRes = await pool.query('SELECT push_token FROM institutes WHERE id = $1', [instituteId]);
        
        // 3. Fetch Special Teachers' Tokens
        const teachersRes = await pool.query(
            'SELECT push_token FROM teachers WHERE institute_id = $1 AND special_permission = true AND push_token IS NOT NULL AND push_token != $2', 
            [instituteId, '']
        );

        const allTokens = [];
        if (principalRes.rows[0]?.push_token) allTokens.push(principalRes.rows[0].push_token);
        teachersRes.rows.forEach(t => {
            if (t.push_token) allTokens.push(t.push_token);
        });

        const uniqueTokens = [...new Set(allTokens)];

        if (uniqueTokens.length > 0) {
            const feeLabel = feeType === 'monthly' ? 'Monthly' : 'Occasional';
            const title = "Fee Payment Received 💰";
            const body = `${student.name} (Cl: ${student.class}-${student.section}, Roll: ${student.roll_no || 'N/A'}) paid ${feeLabel} fee of ₹${amount}.`;
            const data = { type: 'fee_received', studentId, feeType };

            await sendPushNotification(uniqueTokens, title, body, data);
        }
    } catch (error) {
        console.error('Error in notifyFeePayment utility:', error);
    }
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