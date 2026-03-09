import express from 'express';
import { 
    publishOneTimeFee, 
    getOneTimeFeeGroups, 
    getOneTimeGroupDetails, 
    collectOneTimePayment, 
    overrideStudentAmount,
    updateOneTimeFee,
    deleteOneTimeFee
} from '../controllers/oneTimeFeeController.js';
import { protect, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.post('/publish', protect, staffOnly, publishOneTimeFee);
router.get('/groups', protect, staffOnly, getOneTimeFeeGroups);
router.get('/group-details/:groupId', protect, staffOnly, getOneTimeGroupDetails);
router.post('/collect/:paymentId', protect, staffOnly, collectOneTimePayment);
router.patch('/override/:paymentId', protect, staffOnly, overrideStudentAmount);
router.put('/update/:groupId', protect, staffOnly, updateOneTimeFee);
router.delete('/delete/:groupId', protect, staffOnly, deleteOneTimeFee);

export default router;