import express from 'express';
import multer from 'multer';
import { verifyPhone, getStudents, verifyCode, login, getAllUserAccounts, getProfile, updateProfile, updatePushToken, sendTestNotification, getStudentDashboardData } from '../controllers/studentAuthController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Student authentication routes
router.post('/verify-phone', verifyPhone);
router.post('/get-students', getStudents);
router.post('/verify-code', verifyCode);
router.post('/login', login);
router.post('/get-all-accounts', getAllUserAccounts);
router.get('/profile', protect, getProfile);
router.get('/dashboard', protect, getStudentDashboardData);
router.put('/profile', protect, upload.single('photo'), updateProfile);
router.put('/update-token', protect, updatePushToken);
router.post('/test-notification', protect, sendTestNotification);

export default router;
