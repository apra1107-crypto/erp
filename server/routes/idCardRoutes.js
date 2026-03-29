import express from 'express';
import { generateBulkIDCardPDF, generateBulkIDCardJPG } from '../controllers/idCardController.js';
import { protect, staffOnly } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// PDF generation remains staff-only (Principals/Teachers)
router.post('/generate-bulk-pdf', staffOnly, generateBulkIDCardPDF);

// JPG generation is now accessible to both staff and students (for self-service)
router.post('/generate-bulk-jpg', generateBulkIDCardJPG); 

export default router;
