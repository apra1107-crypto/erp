import express from 'express';
import { getTodayAttendance, markAttendance, getAttendanceHistory, getTeacherAttendanceHistoryForPrincipal } from '../controllers/teacherAttendanceController.js';
import { protect, teacherOnly, principalOnly } from '../middlewares/auth.js';

const router = express.Router();

router.get('/today', protect, teacherOnly, getTodayAttendance);
router.post('/mark', protect, teacherOnly, markAttendance);
router.get('/history', protect, teacherOnly, getAttendanceHistory);
router.get('/teacher/:teacherId/history', protect, principalOnly, getTeacherAttendanceHistoryForPrincipal);

export default router;
