import express from 'express';
import { getInstitutes, getInstituteDetails } from '../controllers/adminController.js';
import { protect, adminOnly } from '../middlewares/auth.js';

const router = express.Router();

router.get('/institutes', protect, adminOnly, getInstitutes);
router.get('/institute/:id', protect, adminOnly, getInstituteDetails);

export default router;
