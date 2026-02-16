import Razorpay from 'razorpay';
import crypto from 'crypto';
import db from '../config/db.js';
import { emitToAdmin, emitToPrincipal } from '../utils/socket.js';
import { sendFeeReceiptEmail } from '../utils/aws.js';
import { sendPushNotification, notifyFeePayment } from '../utils/pushNotification.js';

const getRazorpayInstance = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new Error('Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are missing in .env file');
    }

    return new Razorpay({
        key_id,
        key_secret,
    });
};

export const createOrder = async (req, res) => {
    try {
        const razorpay = getRazorpayInstance();
        const { amount, months } = req.body;
        const { instituteId } = req.params;

        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise)
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                instituteId,
                months
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
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const razorpay = getRazorpayInstance();
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            instituteId,
            months,
            amount
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment is verified
            await fulfillSubscription(instituteId, months, amount / 100);

            res.json({
                success: true,
                message: "Payment verified successfully"
            });
        } else {
            res.status(400).json({ success: false, message: "Invalid signature" });
        }
    } catch (error) {
        console.error('Razorpay Verify Error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

const fulfillSubscription = async (instituteId, months, amount) => {
    const currentRes = await db.query('SELECT subscription_end_date FROM subscription_settings WHERE institute_id = $1', [instituteId]);
    let startDate = new Date();
    if (currentRes.rows.length > 0 && currentRes.rows[0].subscription_end_date) {
        const existingEnd = new Date(currentRes.rows[0].subscription_end_date);
        if (existingEnd > startDate) {
            startDate = existingEnd;
        }
    }

    const newEndDate = new Date(startDate);
    // 1 month = 1 minute for testing, or use real months if preferred. 
    // Sticking to user's previous preference of 1 min for testing.
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

    await db.query('INSERT INTO subscription_logs (institute_id, action_type, details, amount) VALUES ($1, $2, $3, $4)',
        [instituteId, 'PAYMENT', `Subscription extended by ${months} months via Razorpay`, amount]);

    emitToAdmin('payment_received', {
        instituteId,
        amount,
        subscription_end_date: result.rows[0].subscription_end_date
    });

    emitToPrincipal(instituteId, 'subscription_update', {
        settings: result.rows[0],
        status: 'active'
    });

    return result.rows[0];
};

// --- Student Fee Payment Logic ---

export const createFeeOrder = async (req, res) => {
    try {
        const razorpay = getRazorpayInstance();
        const { amount, studentFeeId, feeType = 'monthly' } = req.body;

        const options = {
            amount: Math.round(parseFloat(amount) * 100),
            currency: "INR",
            receipt: `fee_${feeType}_${studentFeeId}_${Date.now()}`,
            notes: { studentFeeId, feeType }
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
    } catch (error) {
        console.error('Razorpay Fee Order Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create fee order' });
    }
};

export const verifyFeePayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, studentFeeId, instituteId, feeType, studentId, month_year, amount } = req.body;
    try {
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(sign.toString()).digest("hex");

        if (razorpay_signature === expectedSign) {
            // 1. Handle Virtual Bill Creation if needed
            if (feeType === 'monthly' && studentFeeId.toString().startsWith('VIRTUAL_')) {
                // Fetch config and student to create real record
                const configRes = await db.query('SELECT id, columns, class_data FROM fee_configurations WHERE institute_id = $1 AND month_year = $2', [instituteId, month_year]);
                const config = configRes.rows[0];
                const studentRes = await db.query('SELECT class, transport_facility FROM students WHERE id = $1', [studentId]);
                const student = studentRes.rows[0];

                let breakdown = {};
                let total = 0;
                const columns = typeof config.columns === 'string' ? JSON.parse(config.columns) : config.columns;
                const classData = typeof config.class_data === 'string' ? JSON.parse(config.class_data) : config.class_data;
                const classSettings = classData[student.class];

                columns.forEach(col => {
                    const trimmedCol = col.trim();
                    const isTransport = trimmedCol.toLowerCase().includes('transport') || trimmedCol.toLowerCase().includes('bus');
                    const amt = parseFloat(classSettings[trimmedCol] || 0);
                    if (amt > 0 && (!isTransport || (isTransport && student.transport_facility))) {
                        breakdown[trimmedCol] = amt;
                        total += amt;
                    }
                });

                const insertRes = await db.query(`
                    INSERT INTO student_monthly_fees (student_id, institute_id, config_id, month_year, breakdown, total_amount, status, payment_id, paid_at)
                    VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, CURRENT_TIMESTAMP)
                    RETURNING id
                `, [studentId, instituteId, config.id, month_year, JSON.stringify(breakdown), total, razorpay_payment_id]);

                emitToPrincipal(instituteId, 'fee_payment_update', { studentFeeId: insertRes.rows[0].id, status: 'paid', feeType });
            } else {
                // 2. Regular Update
                if (feeType === 'occasional') {
                    // Update all items in the batch for this student
                    // We need batch_id. If passed in body, use it. Else fetch it.
                    let targetBatchId = req.body.batch_id;

                    if (!targetBatchId) {
                        const fRes = await db.query('SELECT batch_id FROM student_occasional_fees WHERE id = $1', [studentFeeId]);
                        if (fRes.rows.length > 0) targetBatchId = fRes.rows[0].batch_id;
                    }

                    if (targetBatchId) {
                        await db.query(
                            `UPDATE student_occasional_fees 
                             SET status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP 
                             WHERE batch_id = $2 AND student_id = $3`,
                            [razorpay_payment_id, targetBatchId, studentId]
                        );
                    } else {
                        // Fallback single update if no batch found (should not happen)
                        await db.query(
                            `UPDATE student_occasional_fees SET status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`,
                            [razorpay_payment_id, studentFeeId]
                        );
                    }
                } else {
                    // Monthly fee update
                    await db.query(
                        `UPDATE student_monthly_fees SET status = 'paid', payment_id = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`,
                        [razorpay_payment_id, studentFeeId]
                    );
                }

                emitToPrincipal(instituteId, 'fee_payment_update', { studentFeeId, status: 'paid', feeType });
            }

            // --- Send Receipt Email ---
            try {
                // 1. Get Student Details (including email from the saved student record)
                const studentDataRes = await db.query('SELECT name, email, roll_no, class, section FROM students WHERE id = $1', [studentId]);
                const studentData = studentDataRes.rows[0];

                if (studentData && studentData.email) {
                    // 2. Get Institute Details
                    const instDataRes = await db.query('SELECT institute_name, logo_url, address, state, district, pincode, affiliation FROM institutes WHERE id = $1', [instituteId]);
                    const instData = instDataRes.rows[0];

                    // 3. Fetch the newly updated fee record for the PDF
                    let feeRecord;
                    if (feeType === 'occasional') {
                        const feeRes = await db.query('SELECT * FROM student_occasional_fees WHERE student_id = $1 AND payment_id = $2', [studentId, razorpay_payment_id]);
                        // Combine occasional fees if it was a batch
                        if (feeRes.rows.length > 0) {
                            const first = feeRes.rows[0];
                            const totalAmount = feeRes.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
                            const breakdown = {};
                            feeRes.rows.forEach(row => { breakdown[row.description || 'Fee'] = row.amount; });
                            feeRecord = {
                                ...first,
                                total_amount: totalAmount,
                                breakdown,
                                month_year: first.month_year || 'N/A',
                                class: studentData.class,
                                section: studentData.section,
                                roll_no: studentData.roll_no
                            };
                        }
                    } else {
                        const feeRes = await db.query('SELECT * FROM student_monthly_fees WHERE id = $1', [studentFeeId.toString().startsWith('VIRTUAL_') ? null : studentFeeId]);
                        // If it was virtual, we might need a different lookup, but the insertRes inside the if(virtual) block already happened.
                        // For simplicity, let's fetch by payment_id if studentFeeId was virtual
                        if (!feeRes.rows[0]) {
                            const feeRes2 = await db.query('SELECT * FROM student_monthly_fees WHERE student_id = $1 AND payment_id = $2', [studentId, razorpay_payment_id]);
                            feeRecord = feeRes2.rows[0];
                        } else {
                            feeRecord = feeRes.rows[0];
                        }
                        if (feeRecord) {
                            feeRecord.class = studentData.class;
                            feeRecord.section = studentData.section;
                            feeRecord.roll_no = studentData.roll_no;
                        }
                    }

                    if (feeRecord && instData) {
                        console.log(`🚀 PAYMENT VERIFIED: Triggering email for ${studentData.name} (${studentData.email})`);
                        // Use amount from req.body (available after my fix) or record total
                        const finalAmount = amount || feeRecord.total_amount;

                        // Async send (hande in background)
                        sendFeeReceiptEmail(studentData.email, studentData.name, finalAmount, feeRecord, instData)
                            .then(res => console.log(`✅ DISPATCHED: Email status for ${studentData.name}:`, res))
                            .catch(err => console.error(`❌ DISPATCH FAILED for ${studentData.name}:`, err));
                    } else {
                        console.log('⚠️ MISSING DATA: Could not trigger email. feeRecord:', !!feeRecord, 'instData:', !!instData);
                    }
                } else {
                    console.log(`⚠️ NO EMAIL: Student ${studentId} does not have an email address in the database.`);
                }
            } catch (emailErr) {
                console.error('CRITICAL Email Trigger Error:', emailErr);
            }

            // --- Send Push Notification to Principal & Special Teachers ---
            notifyFeePayment(studentId, instituteId, amount, feeType);

            res.json({ success: true, message: "Fee payment verified successfully" });
        } else {
            res.status(400).json({ success: false, message: "Invalid signature" });
        }
    } catch (error) {
        console.error('Fee Verify Error:', error);
        res.status(500).json({ success: false, message: 'Fee verification failed' });
    }
};
