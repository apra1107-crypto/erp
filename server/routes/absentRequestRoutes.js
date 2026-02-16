import express from 'express';
import { submitRequest, getMyRequests, updateRequest, deleteRequest, getRequestsForDate, approveRequest, getStudentAbsentRequests } from '../controllers/absentRequestController.js';
import { protect, studentOnly, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

// Student routes
router.post('/submit', protect, studentOnly, submitRequest);
router.get('/my-requests', protect, studentOnly, getMyRequests);
router.put('/update/:id', protect, studentOnly, updateRequest);
router.delete('/delete/:id', protect, studentOnly, deleteRequest);

// Teacher/Principal routes
router.get('/view', protect, staffOnly, getRequestsForDate);
router.post('/approve/:id', protect, staffOnly, approveRequest);
router.get('/student/:studentId', protect, staffOnly, getStudentAbsentRequests);

export default router;
