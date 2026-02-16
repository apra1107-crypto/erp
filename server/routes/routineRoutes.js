import express from 'express';
import { getRoutinesOverview, getRoutine, saveRoutine, getMyRoutine, getTeachersForStudent, deleteRoutine, getTeacherSchedule } from '../controllers/routineController.js';
import { protect, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.get('/overview/:instituteId', protect, getRoutinesOverview);
router.get('/my-routine', protect, getMyRoutine);
router.get('/teachers-list', protect, getTeachersForStudent);
router.get('/:instituteId/:className/:section', protect, getRoutine);
router.post('/save', protect, staffOnly, saveRoutine);
router.get('/teacher-schedule', protect, getTeacherSchedule);
router.delete('/:instituteId/:className/:section', protect, deleteRoutine);

export default router;
