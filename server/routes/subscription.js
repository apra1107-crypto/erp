import express from 'express';
import {
    getSubscriptionSettings,
    updateSubscriptionSettings,
    checkSubscriptionStatus,
    getSubscriptionLogs,
    processPayment
} from '../controllers/subscriptionController.js';
import { createOrder, verifyPayment } from '../controllers/razorpayController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Get subscription settings for an institute
router.get('/:instituteId', protect, getSubscriptionSettings);

// Update subscription settings (Admin only)
router.put('/:instituteId', protect, updateSubscriptionSettings);

// Check subscription status
router.get('/:instituteId/status', protect, checkSubscriptionStatus);

// Get subscription logs
router.get('/:instituteId/logs', protect, getSubscriptionLogs);

// Process Mock payment (Simulation)
router.post('/:instituteId/payment', protect, processPayment);

// Razorpay Payment Routes
router.post('/:instituteId/razorpay/order', protect, createOrder);
router.post('/:instituteId/razorpay/verify', protect, verifyPayment);

export default router;
