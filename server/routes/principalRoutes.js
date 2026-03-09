import express from 'express';
import multer from 'multer';
import { 
    getDashboard, addStudent, updateStudent, getStudents, deleteStudent, 
    addTeacher, updateTeacher, getTeachers, deleteTeacher, searchEntities, 
    getProfile, updateProfile, getStats, getAttendanceListBySection,
    collectFee, getFeesStatus,
    getMonthlyActivationStatus, toggleMonthlyActivation,
    addExtraCharge, getStudentFeesFull,
    getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount
} from '../controllers/principalController.js';

import { protect, principalOnly, staffOnly, principalOrSpecialTeacher } from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard', protect, principalOrSpecialTeacher, getDashboard);
router.get('/stats', protect, staffOnly, getStats);
router.get('/daily-revenue-details', protect, staffOnly, (req, res, next) => {
    import('../controllers/principalController.js').then(m => m.getDailyRevenueDetails(req, res)).catch(next);
});
router.get('/attendance-list-detail', protect, staffOnly, getAttendanceListBySection);
router.get('/search', protect, staffOnly, searchEntities);
router.post('/student/add', protect, principalOrSpecialTeacher, upload.single('photo'), addStudent);
router.get('/profile', protect, principalOrSpecialTeacher, getProfile);
router.put('/profile/update', protect, principalOrSpecialTeacher, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'principal_photo', maxCount: 1 }]), updateProfile);

// Bank Routes
router.get('/bank-accounts', protect, principalOnly, getBankAccounts);
router.post('/bank-accounts', protect, principalOnly, addBankAccount);
router.put('/bank-accounts/:id', protect, principalOnly, updateBankAccount);
router.delete('/bank-accounts/:id', protect, principalOnly, deleteBankAccount);
router.get('/student/list', protect, staffOnly, getStudents);
router.get('/student/fees-status', protect, principalOrSpecialTeacher, getFeesStatus);
router.get('/student/monthly-fees-activation', protect, principalOrSpecialTeacher, getMonthlyActivationStatus);
router.get('/student/:id/fees-full', protect, staffOnly, getStudentFeesFull);
router.post('/student/toggle-monthly-fees', protect, principalOrSpecialTeacher, toggleMonthlyActivation);
router.post('/student/add-extra-charge', protect, principalOrSpecialTeacher, addExtraCharge);
router.put('/student/update/:id', protect, staffOnly, upload.single('photo'), updateStudent);
router.post('/student/collect-fee/:id', protect, principalOrSpecialTeacher, collectFee);
router.post('/teacher/add', protect, principalOrSpecialTeacher, upload.single('photo'), addTeacher);
router.put('/teacher/update/:id', protect, principalOrSpecialTeacher, upload.single('photo'), updateTeacher);
router.delete('/student/delete/:id', protect, principalOrSpecialTeacher, deleteStudent);
router.delete('/teacher/delete/:id', protect, principalOrSpecialTeacher, deleteTeacher);
router.get('/teacher/list', protect, staffOnly, getTeachers);
router.get('/students-by-session/:sessionId', protect, staffOnly, (req, res, next) => {
    // Import here if needed or just use the exported function
    import('../controllers/principalController.js').then(m => m.getStudentsBySession(req, res)).catch(next);
});

export default router;