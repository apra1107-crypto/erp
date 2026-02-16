import express from 'express';
import { getTeacherSalaries, paySalary, getMySalaryHistory, getTeacherSalaryHistoryForPrincipal } from '../controllers/salaryController.js';
import { protect, principalOnly } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', protect, principalOnly, getTeacherSalaries);
router.post('/pay', protect, principalOnly, paySalary);
router.get('/my-history', protect, getMySalaryHistory);
router.get('/teacher/:teacherId/history', protect, principalOnly, getTeacherSalaryHistoryForPrincipal);

export default router;
