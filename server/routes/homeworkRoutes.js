import express from 'express';
import { createHomework, getHomework, updateHomework, deleteHomework, markAsDone, getHomeworkCompletions } from '../controllers/homeworkController.js';
import { protect, teacherOnly, studentOnly, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.post('/create', protect, staffOnly, createHomework);
router.get('/list', protect, getHomework);
router.put('/update/:id', protect, staffOnly, updateHomework);
router.delete('/delete/:id', protect, staffOnly, deleteHomework);
router.post('/mark-done/:id', protect, studentOnly, markAsDone);
router.get('/completions/:id', protect, staffOnly, getHomeworkCompletions);

export default router;
