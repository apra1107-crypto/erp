import express from 'express';
import { createNotice, getNotices, updateNotice, deleteNotice } from '../controllers/noticeController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

console.log('✅ noticeRoutes loaded');

router.post('/', protect, createNotice);
router.get('/', protect, getNotices);
router.put('/:id', protect, updateNotice);
router.delete('/:id', protect, deleteNotice);

export default router;
