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
    togglePublishExam,
    getPublishedExams,
} from '../controllers/examController.js';
import { protect, staffOnly, studentOnly } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// Student Routes
router.get('/student/published', studentOnly, getPublishedExams);
router.get('/:exam_id/marksheet/:student_id', getStudentMarksheet); // Accessible by both staff and student

// Staff Routes (Principal/Teacher)
router.get('/students/search-class', staffOnly, getClassStudents);
router.post('/create', staffOnly, createExam);
router.get('/list', staffOnly, getExams);
router.delete('/:id', staffOnly, deleteExam);
router.get('/:id', staffOnly, getExamById);
router.put('/:id/stats', staffOnly, updateExamStats);
router.get('/:id/grid', staffOnly, getExamStudents);
router.post('/:exam_id/student/save', staffOnly, saveStudentMarks);
router.patch('/:id/toggle-publish', staffOnly, togglePublishExam);

export default router;

