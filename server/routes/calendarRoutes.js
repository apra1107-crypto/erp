import express from 'express';
import { addEvent, getEvents, deleteEvent } from '../controllers/calendarController.js';
import { protect, principalOnly, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', protect, staffOnly, addEvent);
router.get('/', protect, getEvents); // All authenticated users can view
router.delete('/:id', protect, staffOnly, deleteEvent);

export default router;
