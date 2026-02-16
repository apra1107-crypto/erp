import express from 'express';
import {
    getMonthlyConfig,
    saveAndPublishConfig,
    getFeesTracking,
    getSectionFees,
    getStudentFeeHistory,
    searchStudentsForFees,
    markFeeAsPaidManually,
    getDefaulters,
    getConfiguredMonths,
} from '../controllers/feesController.js';
import {
    addOccasionalCharge,
    getOccasionalHistory,
    markOccasionalPaid,
    markStudentBatchPaid,
    getOccasionalFeeDetails,
    getOccasionalTypes,
    saveOccasionalType,
    deleteOccasionalType,
    getOccasionalDefaulters,
    searchStudentsForOccasionalFees
} from '../controllers/occasionalFeesController.js';
import { createFeeOrder, verifyFeePayment } from '../controllers/razorpayController.js';
import { protect, principalOrSpecialTeacher } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// Principal/Special Teacher Routes
router.get('/config/:instituteId', principalOrSpecialTeacher, getMonthlyConfig);
router.post('/publish/:instituteId', principalOrSpecialTeacher, saveAndPublishConfig);
router.get('/tracking/:instituteId', principalOrSpecialTeacher, getFeesTracking);
router.get('/section/:instituteId/:className/:section', principalOrSpecialTeacher, getSectionFees);
router.post('/occasional/:instituteId', principalOrSpecialTeacher, addOccasionalCharge);
router.get('/occasional-history/:instituteId', principalOrSpecialTeacher, getOccasionalHistory);
router.put('/occasional-pay/:id', principalOrSpecialTeacher, markOccasionalPaid);
router.put('/occasional-batch-pay/:instituteId', principalOrSpecialTeacher, markStudentBatchPaid);
router.get('/occasional-details/:instituteId', principalOrSpecialTeacher, getOccasionalFeeDetails);
router.get('/occasional-types/:instituteId', principalOrSpecialTeacher, getOccasionalTypes);
router.post('/occasional-types/:instituteId', principalOrSpecialTeacher, saveOccasionalType);
router.delete('/occasional-types/:id', principalOrSpecialTeacher, deleteOccasionalType);
router.get('/occasional-defaulters/:instituteId', principalOrSpecialTeacher, getOccasionalDefaulters);
router.get('/occasional-search/:instituteId', principalOrSpecialTeacher, searchStudentsForOccasionalFees);
router.get('/search-students/:instituteId', principalOrSpecialTeacher, searchStudentsForFees);
router.get('/defaulters/:instituteId', principalOrSpecialTeacher, getDefaulters);
router.get('/configured-months/:instituteId', principalOrSpecialTeacher, getConfiguredMonths);
router.put('/manual-pay/:studentFeeId', principalOrSpecialTeacher, markFeeAsPaidManually);

// Student Routes
router.get('/student/:studentId', getStudentFeeHistory);

// Payment Routes (Shared/Student)
router.post('/create-order', createFeeOrder);
router.post('/verify-payment', verifyFeePayment);

export default router;
