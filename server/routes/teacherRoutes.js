import express from 'express';
import multer from 'multer';
import { addStudent, getStudents, searchEntities, getStats, getAttendanceListBySection, getDashboard } from '../controllers/principalController.js';
import { protect, teacherOnly, staffOnly } from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Student management routes for teachers
router.post('/student/add', protect, teacherOnly, upload.single('photo'), addStudent);
router.get('/student/list', protect, teacherOnly, getStudents);
router.get('/search', protect, teacherOnly, searchEntities);

// Stats routes for teachers
router.get('/dashboard', protect, staffOnly, getDashboard);
router.get('/stats', protect, staffOnly, getStats);
router.get('/attendance-list-detail', protect, staffOnly, getAttendanceListBySection);

export default router;
