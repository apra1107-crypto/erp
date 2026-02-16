import express from 'express';
import { registerInstitute, loginInstitute, initiatePasswordReset, verifyOTP, verifyOTPAndReset, getInstituteByEmail, updatePushToken } from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/institute/register', registerInstitute);
router.post('/institute/login', loginInstitute);
router.get('/institute/get-by-email', getInstituteByEmail);
router.post('/institute/forgot-password', initiatePasswordReset);
router.post('/institute/verify-otp', verifyOTP);
router.post('/institute/verify-otp-reset', verifyOTPAndReset);
router.put('/institute/update-token', protect, updatePushToken);

export default router;