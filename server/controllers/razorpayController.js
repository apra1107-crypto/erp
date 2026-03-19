import Razorpay from 'razorpay';
import crypto from 'crypto';
import db from '../config/db.js';
import { emitToPrincipal, emitToAdmin, emitToTeacher, emitToSpecificTeacher, emitToStudent } from '../utils/socket.js';
import { sendSubscriptionSuccessEmail } from '../utils/aws.js';

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

// Subscription Order
export const createOrder = async (req, res) => {
    try {
        const { months, amount, currency = 'INR' } = req.body;
        // months here represents the number of 30-day blocks
        const options = {
            amount: Math.round(amount * 100), // amount in smallest currency unit
            currency,
            receipt: `sub_receipt_${Date.now()}`,
            notes: {
                months: months,
                type: 'subscription_renewal'
            }
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
};

// Subscription Payment Verification
export const verifyPayment = async (req, res) => {
    try {
        const { instituteId } = req.params;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            months,
            amount
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Update subscription (Logic from processPayment)
            const currentRes = await db.query('SELECT subscription_end_date FROM subscription_settings WHERE institute_id = $1', [instituteId]);

            let startDate = new Date();
            if (currentRes.rows.length > 0 && currentRes.rows[0].subscription_end_date) {
                const existingEnd = new Date(currentRes.rows[0].subscription_end_date);
                if (existingEnd > startDate) {
                    startDate = existingEnd;
                }
            }

            const newEndDate = new Date(startDate);
            // PRODUCTION LOGIC: Add multiples of 30 days
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

            const actionDetails = `Razorpay: ₹${Math.round(amount/100)} for ${daysToAdd} Days (${months} Month/s)`;
            const result = await db.query(query, [newEndDate, instituteId, actionDetails]);

            // 1. Get Principal & Institute details for email
            const instRes = await db.query('SELECT principal_name, email, institute_name FROM institutes WHERE id = $1', [instituteId]);
            if (instRes.rows.length > 0) {
                const { principal_name, email, institute_name } = instRes.rows[0];
                sendSubscriptionSuccessEmail(email, principal_name, institute_name, {
                    amount: amount / 100,
                    durationDays: daysToAdd,
                    months: months,
                    expiryDate: result.rows[0].subscription_end_date,
                    transactionId: razorpay_payment_id
                }).catch(err => console.error('Failed to send subscription email:', err));
            }

            // Log payment (Convert amount from paise to rupees for logging)
            const logAmount = parseFloat(amount) / 100;
            await db.query('INSERT INTO subscription_logs (institute_id, action_type, details, amount) VALUES ($1, $2, $3, $4)',
                [instituteId, 'PAYMENT', `Razorpay Payment (${razorpay_payment_id}) - ${daysToAdd} Days`, logAmount]);

            // Notify via Socket
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

            return res.json({ success: true, message: 'Payment verified and subscription extended' });
        } else {
            return res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Razorpay Verification Error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};

// Fee Payment Order
export const createFeeOrder = async (req, res) => {
    try {
        const { amount, studentId, month, year } = req.body;
        if (!amount || !studentId || !month || !year) {
            return res.status(400).json({ error: 'Missing required fee payment details' });
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `fee_receipt_${studentId}_${month}_${year}_${Date.now()}`,
            notes: {
                studentId,
                month,
                year,
                type: 'monthly_fee'
            }
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Razorpay Fee Order Error:', error);
        res.status(500).json({ error: 'Failed to create fee payment order' });
    }
};

// Fee Payment Verification
export const verifyFeePayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            studentId,
            month,
            year,
            amount
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // 1. Get student session info
            const studentRes = await db.query('SELECT institute_id, session_id, name FROM students WHERE id = $1', [studentId]);
            if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
            
            const { institute_id, session_id, name } = studentRes.rows[0];

            // 2. Mark as PAID in student_fees
            await db.query(
                `INSERT INTO student_fees (student_id, institute_id, session_id, month, year, status, paid_at, collected_by, payment_method, transaction_id) 
                 VALUES ($1, $2, $3, $4, $5, 'paid', NOW(), 'Online', 'Razorpay', $6)
                 ON CONFLICT (student_id, month, year, session_id) 
                 DO UPDATE SET status = 'paid', paid_at = NOW(), collected_by = 'Online', payment_method = 'Razorpay', transaction_id = $6`,
                [studentId, institute_id, session_id, month, year, razorpay_payment_id]
            );

            // 3. Notify Principal & Special Teachers via Socket and Push
            try {
                const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                const notifTitle = 'Fee Payment Received';
                const safeAmount = parseFloat(amount || 0).toLocaleString();
                const notifBody = `₹${safeAmount} received from ${name} for ${monthsNames[month - 1]} ${year}.`;

                // Socket Notification to Principal
                emitToPrincipal(institute_id, 'fee_payment_received', {
                    studentId,
                    studentName: name,
                    month,
                    year,
                    amount,
                    paymentId: razorpay_payment_id,
                    type: 'MONTHLY',
                    title: notifTitle,
                    message: notifBody
                });

                // Notify Student
                const studentPushTokenRes = await db.query('SELECT push_token FROM students WHERE id = $1', [studentId]);
                const studentPushToken = studentPushTokenRes.rows[0]?.push_token;
                const studentNotifTitle = 'Payment Success';
                const studentNotifBody = `Your online payment for ${monthsNames[month - 1]} ${year} was successful.`;

                emitToStudent(studentId, 'fee_payment_received', {
                    title: studentNotifTitle,
                    message: studentNotifBody,
                    type: 'fees'
                });

                if (studentPushToken) {
                    const { sendPushNotification } = await import('../utils/pushNotification.js');
                    await sendPushNotification([studentPushToken], studentNotifTitle, studentNotifBody, { type: 'fee_payment' });
                }

                // Fetch push tokens for staff
                const principalPushToken = await db.query('SELECT push_token FROM institutes WHERE id = $1', [institute_id]);
                const specialTeachers = await db.query('SELECT id, push_token FROM teachers WHERE institute_id = $1 AND special_permission = true', [institute_id]);
                
                const tokens = [];
                if (principalPushToken.rows[0]?.push_token) tokens.push(principalPushToken.rows[0].push_token);
                
                specialTeachers.rows.forEach(t => {
                    if (t.push_token) tokens.push(t.push_token);
                    // Also notify via socket
                    emitToSpecificTeacher(t.id, 'fee_payment_received', {
                        title: notifTitle,
                        message: notifBody,
                        type: 'fees'
                    });
                });

                if (tokens.length > 0) {
                    const { sendPushNotification } = await import('../utils/pushNotification.js');
                    await sendPushNotification(tokens, notifTitle, notifBody, { type: 'fee_payment' });
                }
            } catch (notifErr) {
                console.error('[VerifyFee] Notification logic failed:', notifErr);
                // Don't return error, payment is already saved
            }

            return res.json({ success: true, message: 'Fee payment successful' });
        } else {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }
    } catch (error) {
        console.error('Fee Verification Error:', error);
        res.status(500).json({ error: 'Failed to verify fee payment' });
    }
};

// Fee Payment Order (One-Time)
export const createOneTimeFeeOrder = async (req, res) => {
    try {
        const { amount, studentId, paymentId } = req.body;
        if (!amount || !studentId || !paymentId) {
            return res.status(400).json({ error: 'Missing required details' });
        }

        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `ot_receipt_${paymentId}_${Date.now()}`,
            notes: { studentId, paymentId, type: 'one_time_fee' }
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('OT Fee Order Error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
};

// One-Time Fee Verification
export const verifyOneTimeFeePayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            studentId,
            paymentId,
            amount
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            const currentRes = await db.query('SELECT due_amount, paid_amount, reason FROM one_time_fee_payments p JOIN one_time_fee_groups g ON p.group_id = g.id WHERE p.id = $1', [paymentId]);
            if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Payment record not found' });

            const { due_amount, paid_amount, reason } = currentRes.rows[0];
            const newPaidAmount = parseFloat(paid_amount) + parseFloat(amount);
            let status = 'partial';
            if (newPaidAmount >= parseFloat(due_amount)) status = 'paid';

            await db.query(
                `UPDATE one_time_fee_payments SET paid_amount = $1, status = $2, updated_at = NOW() WHERE id = $3 AND student_id = $4`,
                [newPaidAmount, status, paymentId, studentId]
            );

            await db.query(
                `INSERT INTO one_time_fee_transactions (payment_id, amount, payment_method, transaction_id, collected_by)
                 VALUES ($1, $2, 'Razorpay', $3, 'Online')`,
                [paymentId, amount, razorpay_payment_id]
            );

            const studentRes = await db.query('SELECT institute_id, name FROM students WHERE id = $1', [studentId]);
            const { institute_id, name } = studentRes.rows[0];

            // 3. Notify Principal & Special Teachers
            try {
                const notifTitle = 'One-Time Fee Received';
                const safeAmount = parseFloat(amount || 0).toLocaleString();
                const notifBody = `₹${safeAmount} received from ${name} for ${reason || 'Fee'}.`;

                emitToPrincipal(institute_id, 'fee_payment_received', {
                    studentId,
                    studentName: name,
                    amount,
                    paymentId: razorpay_payment_id,
                    type: 'ONE-TIME',
                    title: notifTitle,
                    message: notifBody
                });

                // Notify Student
                const studentPushTokenRes = await db.query('SELECT push_token FROM students WHERE id = $1', [studentId]);
                const studentPushToken = studentPushTokenRes.rows[0]?.push_token;
                const studentNotifTitle = 'One-Time Fee Success';
                const studentNotifBody = `Your online payment for ${reason || 'Fee'} was successful.`;

                emitToStudent(studentId, 'fee_payment_received', {
                    title: studentNotifTitle,
                    message: studentNotifBody,
                    type: 'fees'
                });

                if (studentPushToken) {
                    const { sendPushNotification } = await import('../utils/pushNotification.js');
                    await sendPushNotification([studentPushToken], studentNotifTitle, studentNotifBody, { type: 'fee_payment' });
                }

                const principalPushToken = await db.query('SELECT push_token FROM institutes WHERE id = $1', [institute_id]);
                const specialTeachers = await db.query('SELECT id, push_token FROM teachers WHERE institute_id = $1 AND special_permission = true', [institute_id]);
                
                const tokens = [];
                if (principalPushToken.rows[0]?.push_token) tokens.push(principalPushToken.rows[0].push_token);
                
                specialTeachers.rows.forEach(t => {
                    if (t.push_token) tokens.push(t.push_token);
                    emitToSpecificTeacher(t.id, 'fee_payment_received', {
                        title: notifTitle,
                        message: notifBody,
                        type: 'fees'
                    });
                });

                if (tokens.length > 0) {
                    const { sendPushNotification } = await import('../utils/pushNotification.js');
                    await sendPushNotification(tokens, notifTitle, notifBody, { type: 'fee_payment' });
                }
            } catch (notifErr) {
                console.error('[VerifyOT] Notification logic failed:', notifErr);
            }

            return res.json({ success: true, message: 'One-time fee payment successful' });
        } else {
            return res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('OT Fee Verification Error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};