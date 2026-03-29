import express from 'express';
import { 
    createAdmitCard, 
    getAdmitCards, 
    getStudentsForAdmitCard, 
    deleteAdmitCard, 
    toggleAdmitCardVisibility,
    getMyAdmitCards,
    generateBulkAdmitCardPDF,
    generateStudentAdmitCardPDF
} from '../controllers/admitCardController.js';
import { protect, staffOnly, studentOnly } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// Student route
router.get('/my-cards', studentOnly, getMyAdmitCards);
router.get('/generate-student-pdf/:id', studentOnly, generateStudentAdmitCardPDF);

// Staff routes
router.use(staffOnly);
router.post('/create', createAdmitCard);
router.get('/list', getAdmitCards);
router.post('/students', getStudentsForAdmitCard);
router.patch('/visibility/:id', toggleAdmitCardVisibility);
router.delete('/:id', deleteAdmitCard);
router.post('/generate-bulk-pdf/:id', generateBulkAdmitCardPDF);

export default router;