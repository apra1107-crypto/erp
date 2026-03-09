import pool from '../config/db.js';
import { getIO } from '../utils/socket.js';
import { sendPushNotification } from '../utils/pushNotification.js';

const getISTDate = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};

export const getBuses = async (req, res) => {
    try {
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.headers['x-academic-session-id'];

        if (!sessionId) {
            return res.status(400).json({ message: 'Academic session ID is required' });
        }

        const busesResult = await pool.query(
            'SELECT * FROM buses WHERE institute_id = $1 AND session_id = $2 ORDER BY created_at DESC',
            [instituteId, sessionId]
        );
        const buses = busesResult.rows;
        for (let bus of buses) {
            const staffResult = await pool.query('SELECT name, mobile, role FROM bus_staff WHERE bus_id = $1', [bus.id]);
            bus.staff = staffResult.rows;
            const stopsResult = await pool.query('SELECT * FROM bus_stops WHERE bus_id = $1 ORDER BY order_index ASC', [bus.id]);
            bus.stops = stopsResult.rows;
            const assignmentsResult = await pool.query(
                `SELECT bsa.*, s.name as student_name, s.class, s.section, s.roll_no, s.photo_url 
                 FROM bus_stop_assignments bsa
                 JOIN students s ON bsa.student_id = s.id
                 WHERE bsa.bus_id = $1`,
                [bus.id]
            );
            bus.assignments = assignmentsResult.rows;
        }
        res.json({ buses });
    } catch (error) {
        console.error('Error fetching buses:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const addBus = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const instituteId = req.user.institute_id || req.user.id;
        const sessionId = req.headers['x-academic-session-id'];

        if (!sessionId) {
            return res.status(400).json({ message: 'Academic session ID is required' });
        }

        const { busNumber, driverName, driverMobile, staff, startPoint, endPoint } = req.body;
        const busResult = await client.query(
            'INSERT INTO buses (institute_id, session_id, bus_number, driver_name, driver_mobile, start_point, end_point) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [instituteId, sessionId, busNumber, driverName, driverMobile, startPoint, endPoint]
        );
        const bus = busResult.rows[0];
        if (staff && staff.length > 0) {
            for (let member of staff) {
                if (member.name) {
                    await client.query('INSERT INTO bus_staff (bus_id, name, mobile, role) VALUES ($1, $2, $3, $4)', [bus.id, member.name, member.mobile, member.role || 'Staff']);
                }
            }
        }
        await client.query('COMMIT');
        const finalStaffResult = await pool.query('SELECT name, mobile, role FROM bus_staff WHERE bus_id = $1', [bus.id]);
        bus.staff = finalStaffResult.rows;
        res.status(201).json({ bus });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error' });
    } finally { client.release(); }
};

export const updateBus = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { busNumber, driverName, driverMobile, staff, startPoint, endPoint } = req.body;
        const busResult = await client.query(
            'UPDATE buses SET bus_number = $1, driver_name = $2, driver_mobile = $3, start_point = $4, end_point = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
            [busNumber, driverName, driverMobile, startPoint, endPoint, id]
        );
        if (busResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Bus not found' }); }
        await client.query('DELETE FROM bus_staff WHERE bus_id = $1', [id]);
        if (staff && staff.length > 0) {
            for (let member of staff) {
                if (member.name) {
                    await client.query('INSERT INTO bus_staff (bus_id, name, mobile, role) VALUES ($1, $2, $3, $4)', [id, member.name, member.mobile, member.role || 'Staff']);
                }
            }
        }
        await client.query('COMMIT');
        const bus = busResult.rows[0];
        const finalStaffResult = await pool.query('SELECT name, mobile, role FROM bus_staff WHERE bus_id = $1', [bus.id]);
        bus.staff = finalStaffResult.rows;
        res.json({ bus });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Server error' }); }
    finally { client.release(); }
};

export const deleteBus = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM buses WHERE id = $1', [id]);
        res.json({ message: 'Bus deleted successfully' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const getStops = async (req, res) => {
    try {
        const { busId } = req.params;
        const result = await pool.query('SELECT * FROM bus_stops WHERE bus_id = $1 ORDER BY order_index ASC', [busId]);
        res.json({ stops: result.rows });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const saveStops = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { busId } = req.params;
        const { stops } = req.body;
        await client.query('DELETE FROM bus_stops WHERE bus_id = $1', [busId]);
        if (stops && stops.length > 0) {
            for (let stop of stops) {
                await client.query('INSERT INTO bus_stops (bus_id, stop_name, order_index) VALUES ($1, $2, $3)', [busId, stop.stop_name, stop.order_index]);
            }
        }
        await client.query('COMMIT');
        res.json({ message: 'Stops updated successfully' });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Server error' }); }
    finally { client.release(); }
};

export const getStopAssignments = async (req, res) => {
    try {
        const { busId } = req.params;
        const result = await pool.query(
            `SELECT bsa.*, s.name, s.class, s.section, s.roll_no, s.photo_url 
             FROM bus_stop_assignments bsa
             JOIN students s ON bsa.student_id = s.id
             WHERE bsa.bus_id = $1`,
            [busId]
        );
        res.json({ assignments: result.rows });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const assignStudentToStop = async (req, res) => {
    try {
        const { busId } = req.params;
        const { studentId, stopId } = req.body;
        await pool.query(
            `INSERT INTO bus_stop_assignments (bus_id, student_id, stop_id) 
             VALUES ($1, $2, $3)
             ON CONFLICT (student_id, bus_id) DO UPDATE SET stop_id = EXCLUDED.stop_id`,
            [busId, studentId, stopId]
        );
        res.json({ message: 'Student assigned' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const removeStudentFromStop = async (req, res) => {
    try {
        const { busId, studentId } = req.params;
        await pool.query('DELETE FROM bus_stop_assignments WHERE bus_id = $1 AND student_id = $2', [busId, studentId]);
        res.json({ message: 'Student removed' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const syncManifest = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { busId } = req.params;
        const { startPoint, endPoint, stops, assignments } = req.body;
        await client.query('UPDATE buses SET start_point = $1, end_point = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [startPoint, endPoint, busId]);
        await client.query('DELETE FROM bus_stops WHERE bus_id = $1', [busId]);
        const stopIdMap = {};
        for (let stop of stops) {
            const stopResult = await client.query('INSERT INTO bus_stops (bus_id, stop_name, order_index) VALUES ($1, $2, $3) RETURNING id', [busId, stop.stop_name, stop.order_index]);
            stopIdMap[stop.stop_name] = stopResult.rows[0].id;
        }
        for (let assign of assignments) {
            const dbStopId = stopIdMap[assign.stop_name];
            if (dbStopId) {
                await client.query('INSERT INTO bus_stop_assignments (bus_id, student_id, stop_id) VALUES ($1, $2, $3)', [busId, assign.student_id, dbStopId]);
            }
        }
        await client.query('COMMIT');
        res.json({ message: 'Manifest synchronized' });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Sync failed' }); }
    finally { client.release(); }
};

/**
 * HISTORICAL TRACKING LOGIC
 * This ensures that on any given date, the manifest is "locked" so student stop changes
 * don't affect past records.
 */
const ensureDailyManifest = async (busId, date, type) => {
    // Check if manifest already exists for this date and type
    const check = await pool.query('SELECT 1 FROM bus_daily_manifest WHERE bus_id = $1 AND log_date = $2 AND type = $3 LIMIT 1', [busId, date, type]);
    if (check.rows.length === 0) {
        // Copy current "Master List" to Daily Manifest
        await pool.query(
            `INSERT INTO bus_daily_manifest (bus_id, student_id, stop_id, log_date, type)
             SELECT bus_id, student_id, stop_id, $2, $3
             FROM bus_stop_assignments
             WHERE bus_id = $1`,
            [busId, date, type]
        );
    }
};

export const getPublicBusManifest = async (req, res) => {
    try {
        const { busId } = req.params;
        const { date, type = 'pickup' } = req.query;
        const targetDate = date || getISTDate();

        await ensureDailyManifest(busId, targetDate, type);

        const busRes = await pool.query('SELECT * FROM buses WHERE id = $1', [busId]);
        const staffRes = await pool.query('SELECT name, mobile, role FROM bus_staff WHERE bus_id = $1', [busId]);
        const stopsRes = await pool.query('SELECT * FROM bus_stops WHERE bus_id = $1 ORDER BY order_index ASC', [busId]);
        
        // Fetch assignments from daily manifest instead of master table
        const assignmentsRes = await pool.query(
            `SELECT bdm.*, s.name as student_name, s.class, s.section, s.roll_no, s.photo_url 
             FROM bus_daily_manifest bdm
             JOIN students s ON bdm.student_id = s.id
             WHERE bdm.bus_id = $1 AND bdm.log_date = $2 AND bdm.type = $3`,
            [busId, targetDate, type]
        );

        res.json({ bus: { ...busRes.rows[0], staff: staffRes.rows }, stops: stopsRes.rows, assignments: assignmentsRes.rows });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const markStudentBoarding = async (req, res) => {
    try {
        const { busId } = req.params;
        const { studentId, stopId, type, status, date } = req.body;
        const targetDate = date || getISTDate();

        // Ensure manifest exists for today
        await ensureDailyManifest(busId, targetDate, type);

        const logResult = await pool.query(
            `INSERT INTO transport_logs (bus_id, student_id, stop_id, log_date, type, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (bus_id, student_id, log_date, type) 
             DO UPDATE SET status = EXCLUDED.status, marked_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [busId, studentId, stopId, targetDate, type, status]
        );

        const markedLog = logResult.rows[0];

        // --- Proactive Proximity Alert Logic ---
        if (status === 'boarded' || status === 'dropped' || status === 'absent') {
            try {
                // Check if this is the first student marked at this stop for this date/type/bus (any status)
                const checkFirstAtStop = await pool.query(
                    `SELECT COUNT(*) FROM transport_logs 
                     WHERE bus_id = $1 AND stop_id = $2 AND log_date = $3 AND type = $4`,
                    [busId, stopId, targetDate, type]
                );

                if (parseInt(checkFirstAtStop.rows[0].count) === 1) {
                    // Fetch the current stop's order_index
                    const currentStopRes = await pool.query('SELECT order_index, stop_name FROM bus_stops WHERE id = $1', [stopId]);
                    if (currentStopRes.rows.length > 0) {
                        const currentIndex = currentStopRes.rows[0].order_index;
                        const currentStopName = currentStopRes.rows[0].stop_name;

                        // Find the next stop in the sequence (more robust than index+1)
                        const nextStopRes = await pool.query(
                            `SELECT id, stop_name FROM bus_stops 
                             WHERE bus_id = $1 AND order_index > $2 
                             ORDER BY order_index ASC LIMIT 1`,
                            [busId, currentIndex]
                        );

                        if (nextStopRes.rows.length > 0) {
                            const nextStopId = nextStopRes.rows[0].id;
                            const nextStopName = nextStopRes.rows[0].stop_name;

                            // Find all students assigned to this next stop (using daily manifest)
                            const nextStopStudents = await pool.query(
                                `SELECT s.push_token, s.name 
                                 FROM bus_daily_manifest bdm
                                 JOIN students s ON bdm.student_id = s.id
                                 WHERE bdm.bus_id = $1 AND bdm.stop_id = $2 AND bdm.log_date = $3 AND bdm.type = $4`,
                                [busId, nextStopId, targetDate, type]
                            );

                            const tokens = nextStopStudents.rows
                                .map(s => s.push_token)
                                .filter(token => token && token.startsWith('ExponentPushToken'));

                            if (tokens.length > 0) {
                                const title = "Get Ready! 🚌";
                                const body = type === 'pickup' 
                                    ? `Your bus has just left ${currentStopName} and is heading towards your stop (${nextStopName}). Please be ready at the pickup point.`
                                    : `Your bus has just left ${currentStopName} and is heading towards your stop (${nextStopName}). Get ready to deboard.`;
                                
                                await sendPushNotification(tokens, title, body, { 
                                    type: 'transport_proximity', 
                                    busId, 
                                    nextStopId 
                                });
                            }
                        }
                    }
                }
            } catch (notifError) {
                console.error('Proximity alert error:', notifError);
                // Don't fail the request if notification fails
            }
        }

        const io = getIO();
        io.to(`institute_${busId}`).emit('transport_status_update', { 
            busId, 
            studentId, 
            stopId, 
            type, 
            status, 
            date: targetDate,
            marked_at: markedLog.marked_at 
        });
        res.json({ log: markedLog });
    } catch (error) { res.status(500).json({ message: 'Failed to update' }); }
};

export const getTransportLogs = async (req, res) => {
    try {
        const { busId } = req.params;
        const { date, type } = req.query;
        // Ensure manifest exists for the historical date we are viewing
        await ensureDailyManifest(busId, date, type);
        
        const logsRes = await pool.query('SELECT * FROM transport_logs WHERE bus_id = $1 AND log_date = $2 AND type = $3', [busId, date, type]);
        const tripRes = await pool.query('SELECT status FROM bus_trips WHERE bus_id = $1 AND log_date = $2 AND type = $3', [busId, date, type]);
        const assignmentsRes = await pool.query(
            `SELECT bdm.*, s.name as student_name, s.class, s.section, s.roll_no, s.photo_url 
             FROM bus_daily_manifest bdm
             JOIN students s ON bdm.student_id = s.id
             WHERE bdm.bus_id = $1 AND bdm.log_date = $2 AND bdm.type = $3`,
            [busId, date, type]
        );
        res.json({ logs: logsRes.rows, assignments: assignmentsRes.rows, tripStatus: tripRes.rows[0]?.status || 'pending' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const getPublicLogs = async (req, res) => {
    try {
        const { busId } = req.params;
        const { date, type } = req.query;
        const result = await pool.query('SELECT student_id, status, stop_id FROM transport_logs WHERE bus_id = $1 AND log_date = $2 AND type = $3', [busId, date, type]);
        
        // Also fetch trip status
        const tripRes = await pool.query('SELECT status FROM bus_trips WHERE bus_id = $1 AND log_date = $2 AND type = $3', [busId, date, type]);
        
        res.json({ logs: result.rows, tripStatus: tripRes.rows[0]?.status || 'pending' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const updateTripStatus = async (req, res) => {
    try {
        const { busId } = req.params;
        const { status, date, type } = req.body;
        
        const result = await pool.query(
            `INSERT INTO bus_trips (bus_id, log_date, type, status, started_at, completed_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, NULL)
             ON CONFLICT (bus_id, log_date, type) 
             DO UPDATE SET 
                status = EXCLUDED.status, 
                completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN CURRENT_TIMESTAMP ELSE bus_trips.completed_at END
             RETURNING *`,
            [busId, date, type, status]
        );

        // Emit socket event
        const io = getIO();
        io.to(`institute_${busId}`).emit('trip_status_update', {
            busId, status, date, type
        });

        res.json({ trip: result.rows[0] });
    } catch (error) {
        console.error('Update trip error:', error);
        res.status(500).json({ message: 'Failed to update trip' });
    }
};