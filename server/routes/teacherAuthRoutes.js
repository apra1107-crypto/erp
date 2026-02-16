import express from 'express';
import multer from 'multer';
import { verifyPhone, getTeachers, verifyCode, login, getAllUserAccounts, getProfile, updateProfile, updatePushToken } from '../controllers/teacherAuthController.js';
import { protect, teacherOnly } from '../middlewares/auth.js';

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Teacher authentication routes
router.post('/verify-phone', verifyPhone);
router.post('/get-teachers', getTeachers);
router.post('/verify-code', verifyCode);
router.post('/login', login);
router.post('/get-all-accounts', getAllUserAccounts);
router.put('/update-token', protect, teacherOnly, updatePushToken);

// Profile routes
router.get('/profile', protect, teacherOnly, getProfile);
router.put('/profile/update', protect, teacherOnly, upload.single('photo'), updateProfile);

export default router;
