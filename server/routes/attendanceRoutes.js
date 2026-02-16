import express from 'express';
import { takeAttendance, getAttendance, getAttendanceLogs, getMyAttendance, getStudentAttendance, getAttendanceStatusBySection } from '../controllers/attendanceController.js';
import { protect, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.post('/take', protect, staffOnly, takeAttendance);
router.get('/view', protect, staffOnly, getAttendance);
router.get('/logs', protect, staffOnly, getAttendanceLogs);
router.get('/my-attendance', protect, getMyAttendance);
router.get('/student/:studentId', protect, staffOnly, getStudentAttendance);
router.get('/get-status', protect, staffOnly, getAttendanceStatusBySection);

export default router;
