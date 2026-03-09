import express from 'express';
import { promoteStudent } from '../controllers/promotionController.js';
import { protect, staffOnly, principalOrSpecialTeacher } from '../middlewares/auth.js';

const router = express.Router();

router.post('/student', protect, staffOnly, promoteStudent);

export default router;
