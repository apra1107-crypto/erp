import express from 'express';
import multer from 'multer';
import { getDashboard, addStudent, updateStudent, getStudents, deleteStudent, addTeacher, updateTeacher, getTeachers, deleteTeacher, searchEntities, getProfile, updateProfile, getStats, getAttendanceListBySection } from '../controllers/principalController.js';

import { protect, principalOnly, staffOnly, principalOrSpecialTeacher } from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard', protect, principalOrSpecialTeacher, getDashboard);
router.get('/stats', protect, principalOnly, getStats);
router.get('/attendance-list-detail', protect, principalOnly, getAttendanceListBySection);
router.get('/search', protect, principalOrSpecialTeacher, searchEntities);
router.post('/student/add', protect, principalOrSpecialTeacher, upload.single('photo'), addStudent);
router.get('/profile', protect, principalOrSpecialTeacher, getProfile);
router.put('/profile/update', protect, principalOrSpecialTeacher, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'principal_photo', maxCount: 1 }]), updateProfile);
router.get('/student/list', protect, staffOnly, getStudents);
router.put('/student/update/:id', protect, principalOrSpecialTeacher, upload.single('photo'), updateStudent);
router.post('/teacher/add', protect, principalOrSpecialTeacher, upload.single('photo'), addTeacher);
router.put('/teacher/update/:id', protect, principalOrSpecialTeacher, upload.single('photo'), updateTeacher);
router.delete('/student/delete/:id', protect, principalOrSpecialTeacher, deleteStudent);
router.delete('/teacher/delete/:id', protect, principalOrSpecialTeacher, deleteTeacher);
router.get('/teacher/list', protect, staffOnly, getTeachers);
router.get('/students-by-session/:sessionId', protect, principalOnly, (req, res, next) => {
    // Import here if needed or just use the exported function
    import('../controllers/principalController.js').then(m => m.getStudentsBySession(req, res)).catch(next);
});

export default router;