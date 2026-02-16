import express from 'express';
import { promoteStudent } from '../controllers/promotionController.js';
import { protect, principalOnly } from '../middlewares/auth.js';

const router = express.Router();

router.post('/student', protect, principalOnly, promoteStudent);

export default router;
