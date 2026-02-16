import pool from './config/db.js';
import { sendMulticastPushNotification } from './utils/pushNotification.js';
import dotenv from 'dotenv';
dotenv.config();

const testNotification = async () => {
    const studentId = process.argv[2]; // Pass student ID as argument

    if (!studentId) {
        console.error('Please provide a student ID. Usage: node test_notification.js <student_id>');
        process.exit(1);
    }

    try {
        console.log(`Fetching token for student ID: ${studentId}...`);
        const res = await pool.query('SELECT name, push_token FROM students WHERE id = $1', [studentId]);
        
        if (res.rows.length === 0) {
            console.error('Student not found.');
            process.exit(1);
        }

        const student = res.rows[0];
        console.log(`Found Student: ${student.name}`);
        console.log(`Token: ${student.push_token || 'NONE'}`);

        if (!student.push_token) {
            console.error('No push token found for this student. Login with the app first.');
            process.exit(1);
        }

        console.log('Sending test notification...');
        const messages = [{
            to: student.push_token,
            title: "Test Banner Notification 🔔",
            body: "If you see this as a banner, the fix worked! 🚀",
            data: { type: 'test' },
            priority: 'high',
            channelId: 'klassin-alerts-v2'
        }];

        const tickets = await sendMulticastPushNotification(messages);
        console.log('Result:', JSON.stringify(tickets, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
};

testNotification();