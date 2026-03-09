import express from 'express';
import { 
    createOrder, verifyPayment, 
    createFeeOrder, verifyFeePayment,
    createOneTimeFeeOrder, verifyOneTimeFeePayment
} from '../controllers/razorpayController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Subscription routes
router.post('/create-order', protect, createOrder);
router.post('/verify-payment/:instituteId', protect, verifyPayment);

// Student Fee routes (Monthly)
router.post('/fees/create-order', protect, createFeeOrder);
router.post('/fees/verify-payment', protect, verifyFeePayment);

// Student Fee routes (One-Time)
router.post('/ot-fees/create-order', protect, createOneTimeFeeOrder);
router.post('/ot-fees/verify-payment', protect, verifyOneTimeFeePayment);

export default router;
