import pool from '../config/db.js';

// 1. Publish One-Time Fee
const publishOneTimeFee = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('[PublishOT] Received Request Body:', JSON.stringify(req.body, null, 2));
        console.log('[PublishOT] User Info:', req.user);

        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        if (!sessionId) {
            const sessionRes = await client.query(
                'SELECT id FROM academic_sessions WHERE institute_id = $1 AND is_active = true LIMIT 1',
                [instituteId]
            );
            sessionId = sessionRes.rows[0]?.id;
        }

        if (!sessionId) {
            return res.status(400).json({ message: 'Active academic session not found' });
        }

        const { reason, reasonsBreakdown, classConfigs, studentIds } = req.body; 

        if (!reason || !reasonsBreakdown || !classConfigs || !studentIds || studentIds.length === 0) {
            return res.status(400).json({ message: 'Missing required data' });
        }

        await client.query('BEGIN');

        // Create the Group
        const classesArray = classConfigs.map(c => c.className);
        const groupRes = await client.query(
            `INSERT INTO one_time_fee_groups (institute_id, session_id, reason, classes, reasons)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [instituteId, sessionId, reason, classesArray, JSON.stringify(reasonsBreakdown)]
        );
        const groupId = groupRes.rows[0].id;

        // Create Class Configurations
        for (const config of classConfigs) {
            const classTotal = config.reasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            await client.query(
                `INSERT INTO one_time_fee_class_configs (group_id, class_name, base_amount, reasons)
                 VALUES ($1, $2, $3, $4)`,
                [groupId, config.className, classTotal, JSON.stringify(config.reasons)]
            );
        }

        // Create Individual Payments
        const studentInfoRes = await client.query(
            `SELECT id, class FROM students WHERE id = ANY($1)`,
            [studentIds]
        );

        const classAmountMap = {};
        const classReasonsMap = {};
        classConfigs.forEach(c => {
            classAmountMap[c.className] = c.reasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            classReasonsMap[c.className] = c.reasons;
        });

        for (const student of studentInfoRes.rows) {
            const dueAmount = classAmountMap[student.class] || 0;
            const reasonsBreakdown = classReasonsMap[student.class] || [];
            await client.query(
                `INSERT INTO one_time_fee_payments (group_id, student_id, due_amount, reasons)
                 VALUES ($1, $2, $3, $4)`,
                [groupId, student.id, dueAmount, JSON.stringify(reasonsBreakdown)]
            );
        }

        await client.query('COMMIT');

        // 3. Notify Students via Socket & Push
        try {
            const { emitToAllStudents } = await import('../utils/socket.js');
            const { sendMulticastPushNotification } = await import('../utils/pushNotification.js');

            const notifTitle = 'New One-Time Fee';
            const notifBody = `A new fee for "${reason}" has been published. Please check your dues.`;

            // Socket Notification (To all students in institute)
            emitToAllStudents(instituteId, 'one_time_fee_published', {
                title: notifTitle,
                message: notifBody,
                reason: reason,
                type: 'fees'
            });

            // Push Notification to selected students
            const studentTokensRes = await pool.query(
                'SELECT push_token FROM students WHERE id = ANY($1) AND push_token IS NOT NULL AND push_token != $2',
                [studentIds, '']
            );

            if (studentTokensRes.rows.length > 0) {
                const messages = studentTokensRes.rows.map(row => ({
                    to: row.push_token,
                    title: notifTitle,
                    body: notifBody,
                    data: { type: 'one_time_fee' }
                }));
                await sendMulticastPushNotification(messages);
            }
        } catch (notifErr) {
            console.error('[PublishOT] Notification logic failed:', notifErr);
        }

        res.status(201).json({ message: 'One-time fees published successfully', groupId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Publish OT fee error:', error);
        res.status(500).json({ message: 'Server error while publishing fees' });
    } finally {
        client.release();
    }
};

// 2. Get All Fee Groups (For Flashcards)
const getOneTimeFeeGroups = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        let sessionId = req.user.current_session_id;

        // Fallback: If sessionId is not in req.user, try to find the active session for this institute
        if (!sessionId) {
            console.log("DEBUG: sessionId missing from req.user, fetching active session...");
            const sessionRes = await pool.query(
                'SELECT id FROM academic_sessions WHERE institute_id = $1 AND is_active = true LIMIT 1',
                [instituteId]
            );
            sessionId = sessionRes.rows[0]?.id;
        }

        if (!sessionId) {
            return res.status(200).json({ groups: [], message: 'No academic session found' });
        }

        const query = `
            SELECT g.*, 
            (SELECT COUNT(*) FROM one_time_fee_payments p WHERE p.group_id = g.id)::int as student_count,
            (SELECT COALESCE(SUM(due_amount), 0) FROM one_time_fee_payments p WHERE p.group_id = g.id) as expected_total,
            (SELECT COALESCE(SUM(paid_amount), 0) FROM one_time_fee_payments p WHERE p.group_id = g.id) as collected_total,
            (SELECT COUNT(*) FROM one_time_fee_payments p WHERE p.group_id = g.id AND p.status = 'paid')::int as fully_paid_count
            FROM one_time_fee_groups g
            WHERE g.institute_id = $1 AND g.session_id = $2
            ORDER BY g.created_at DESC
        `;
        const result = await pool.query(query, [instituteId, sessionId]);
        res.status(200).json({ groups: result.rows });
    } catch (error) {
        console.error('Get OT groups error:', error);
        res.status(500).json({ message: 'Server error fetching groups' });
    }
};

// 3. Get Group Details (Student List)
const getOneTimeGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;

        const query = `
            SELECT p.*, s.name, s.class, s.section, s.roll_no, s.photo_url,
            c.base_amount as original_amount,
            p.reasons as breakdown,
            (SELECT json_agg(t ORDER BY t.created_at ASC) 
             FROM one_time_fee_transactions t 
             WHERE t.payment_id = p.id) as transactions
            FROM one_time_fee_payments p
            JOIN students s ON p.student_id = s.id
            JOIN one_time_fee_groups g ON p.group_id = g.id
            JOIN one_time_fee_class_configs c ON c.group_id = g.id AND c.class_name = s.class
            WHERE p.group_id = $1 AND g.institute_id = $2
            ORDER BY s.class, s.section, s.roll_no
        `;
        const result = await pool.query(query, [groupId, instituteId]);
        res.status(200).json({ students: result.rows });
    } catch (error) {
        console.error('Get OT details error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 4. Collect Payment (Manual with partial support)
const collectOneTimePayment = async (req, res) => {
    const client = await pool.connect();
    try {
        const { paymentId } = req.params;
        const { amountReceived } = req.body;
        const collectedBy = req.user.name || 'Principal';

        await client.query('BEGIN');

        const currentRes = await client.query('SELECT due_amount, paid_amount FROM one_time_fee_payments WHERE id = $1', [paymentId]);
        if (currentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Record not found' });
        }

        const { due_amount, paid_amount } = currentRes.rows[0];
        const newPaidAmount = parseFloat(paid_amount) + parseFloat(amountReceived);
        
        let status = 'partial';
        if (newPaidAmount >= parseFloat(due_amount)) status = 'paid';

        await client.query(
            `UPDATE one_time_fee_payments 
             SET paid_amount = $1, status = $2, updated_at = NOW() 
             WHERE id = $3`,
            [newPaidAmount, status, paymentId]
        );

        await client.query(
            `INSERT INTO one_time_fee_transactions (payment_id, amount, payment_method, collected_by)
             VALUES ($1, $2, 'Cash', $3)`,
            [paymentId, amountReceived, collectedBy]
        );

        await client.query('COMMIT');

        // 3. Notify Principal & Special Teachers
        const studentInfo = await client.query('SELECT institute_id, name FROM students WHERE id = (SELECT student_id FROM one_time_fee_payments WHERE id = $1)', [paymentId]);
        const institute_id = studentInfo.rows[0].institute_id;
        const name = studentInfo.rows[0].name;
        
        const notifTitle = 'Manual One-Time Fee';
        const notifBody = `₹${amountReceived.toLocaleString()} collected for ${name} (${currentRes.rows[0].reason || 'Fee'}).`;

        const { emitToPrincipal, emitToSpecificTeacher, emitToStudent } = await import('../utils/socket.js');
        const student_id = (await client.query('SELECT student_id FROM one_time_fee_payments WHERE id = $1', [paymentId])).rows[0].student_id;
        
        emitToPrincipal(institute_id, 'fee_payment_received', {
            studentId: student_id,
            studentName: name,
            amount: amountReceived,
            type: 'ONE-TIME',
            title: notifTitle,
            message: notifBody
        });

        // Notify Student
        const studentPushTokenRes = await client.query('SELECT push_token FROM students WHERE id = $1', [student_id]);
        const studentPushToken = studentPushTokenRes.rows[0]?.push_token;
        const studentNotifTitle = 'Payment Received';
        const studentNotifBody = `₹${amountReceived.toLocaleString()} has been credited towards your ${currentRes.rows[0].reason || 'Fee'}.`;

        emitToStudent(student_id, 'fee_payment_received', {
            title: studentNotifTitle,
            message: studentNotifBody,
            type: 'fees'
        });

        if (studentPushToken) {
            const { sendPushNotification } = await import('../utils/pushNotification.js');
            await sendPushNotification([studentPushToken], studentNotifTitle, studentNotifBody, { type: 'fee_payment' });
        }

        // Push Notification Logic for Staff
        const principalPushToken = await client.query('SELECT push_token FROM institutes WHERE id = $1', [institute_id]);
        const specialTeachers = await client.query('SELECT id, push_token FROM teachers WHERE institute_id = $1 AND special_permission = true', [institute_id]);
        
        const tokens = [];
        if (principalPushToken.rows[0]?.push_token) tokens.push(principalPushToken.rows[0].push_token);
        
        specialTeachers.rows.forEach(t => {
            if (t.push_token) {
                tokens.push(t.push_token);
                emitToSpecificTeacher(t.id, 'fee_payment_received', {
                    title: notifTitle,
                    message: notifBody,
                    type: 'fees'
                });
            }
        });

        if (tokens.length > 0) {
            const { sendPushNotification } = await import('../utils/pushNotification.js');
            await sendPushNotification(tokens, notifTitle, notifBody, { type: 'fee_payment' });
        }

        res.status(200).json({ message: 'Payment updated', status, newPaidAmount });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Collect OT payment error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// 5. Override Student Amount
const overrideStudentAmount = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { reasons } = req.body; // [{ reason, amount }, ...]

        const newTotal = reasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        await pool.query(
            `UPDATE one_time_fee_payments SET due_amount = $1, reasons = $2, updated_at = NOW() WHERE id = $3`,
            [newTotal, JSON.stringify(reasons), paymentId]
        );

        res.status(200).json({ message: 'Amount overridden successfully' });
    } catch (error) {
        console.error('Override OT amount error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 6. Update One-Time Fee Group
const updateOneTimeFee = async (req, res) => {
    const client = await pool.connect();
    try {
        const { groupId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;
        const { reason, reasonsBreakdown, classConfigs, studentIds } = req.body;

        await client.query('BEGIN');

        const classesArray = classConfigs.map(c => c.className);
        await client.query(
            `UPDATE one_time_fee_groups SET reason = $1, classes = $2, reasons = $3 
             WHERE id = $4 AND institute_id = $5`,
            [reason, classesArray, JSON.stringify(reasonsBreakdown), groupId, instituteId]
        );

        await client.query('DELETE FROM one_time_fee_class_configs WHERE group_id = $1', [groupId]);
        for (const config of classConfigs) {
            const classTotal = config.reasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            await client.query(
                `INSERT INTO one_time_fee_class_configs (group_id, class_name, base_amount, reasons)
                 VALUES ($1, $2, $3, $4)`,
                [groupId, config.className, classTotal, JSON.stringify(config.reasons)]
            );
        }

        await client.query(
            `DELETE FROM one_time_fee_payments 
             WHERE group_id = $1 AND NOT (student_id = ANY($2)) AND paid_amount = 0`,
            [groupId, studentIds]
        );

        const studentInfoRes = await client.query(
            `SELECT id, class FROM students WHERE id = ANY($1)`,
            [studentIds]
        );

        const classAmountMap = {};
        const classReasonsMap = {};
        classConfigs.forEach(c => {
            classAmountMap[c.className] = c.reasons.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            classReasonsMap[c.className] = c.reasons;
        });

        for (const student of studentInfoRes.rows) {
            const dueAmount = classAmountMap[student.class] || 0;
            const reasonsBreakdown = classReasonsMap[student.class] || [];

            await client.query(
                `INSERT INTO one_time_fee_payments (group_id, student_id, due_amount, reasons)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (group_id, student_id)
                 DO UPDATE SET due_amount = $3, reasons = $4 WHERE one_time_fee_payments.paid_amount = 0`,
                [groupId, student.id, dueAmount, JSON.stringify(reasonsBreakdown)]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Fee group updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update OT fee error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// 7. Delete One-Time Fee Group
const deleteOneTimeFee = async (req, res) => {
    try {
        const { groupId } = req.params;
        const instituteId = req.user.institute_id || req.user.id;

        // Note: CASCADE on the database table definitions handles the cleanup of 
        // class_configs, payments, and transactions automatically.
        const result = await pool.query(
            'DELETE FROM one_time_fee_groups WHERE id = $1 AND institute_id = $2',
            [groupId, instituteId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Fee group not found' });
        }

        res.status(200).json({ message: 'Fee group deleted successfully' });
    } catch (error) {
        console.error('Delete OT fee error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export {
    publishOneTimeFee,
    getOneTimeFeeGroups,
    getOneTimeGroupDetails,
    collectOneTimePayment,
    overrideStudentAmount,
    updateOneTimeFee,
    deleteOneTimeFee
};