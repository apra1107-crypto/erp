import express from 'express';
import {
    createExam,
    getExams,
    deleteExam,
    updateExamStats,
    getExamById,
    getExamStudents,
    saveStudentMarks,
    getStudentMarksheet,
    getClassStudents,
} from '../controllers/examController.js';
import { protect, principalOnly } from '../middlewares/auth.js';

const router = express.Router();

// All routes require Principal access for now
router.use(protect);
router.use(principalOnly);

router.get('/students/search-class', getClassStudents); // Helper route
router.post('/create', createExam);
router.get('/list', getExams);
router.delete('/:id', deleteExam);
router.get('/:id', getExamById);
router.put('/:id/stats', updateExamStats);
router.get('/:id/grid', getExamStudents);
router.post('/:exam_id/student/save', saveStudentMarks);
router.get('/:exam_id/marksheet/:student_id', getStudentMarksheet);

export default router;

