import express from 'express';
import { takeAttendance, getAttendance, getAttendanceLogs, getMyAttendance, getStudentAttendance, getAttendanceStatusBySection, getAttendanceDashboard } from '../controllers/attendanceController.js';
import { protect, staffOnly } from '../middlewares/auth.js';
import { attendanceRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/take', protect, staffOnly, attendanceRateLimiter, takeAttendance);
router.get('/sync', protect, staffOnly, getAttendanceDashboard);
router.get('/view', protect, staffOnly, getAttendance);
router.get('/logs', protect, staffOnly, getAttendanceLogs);
router.get('/my-attendance', protect, getMyAttendance);
router.get('/student/:studentId', protect, staffOnly, getStudentAttendance);
router.get('/get-status', protect, staffOnly, getAttendanceStatusBySection);

export default router;
