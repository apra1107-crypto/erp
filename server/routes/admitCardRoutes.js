import express from 'express';
import { 
    createAdmitCard, 
    getAdmitCards, 
    getStudentsForAdmitCard, 
    deleteAdmitCard, 
    toggleAdmitCardVisibility,
    getMyAdmitCards 
} from '../controllers/admitCardController.js';
import { protect, staffOnly, studentOnly } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// Student route
router.get('/my-cards', studentOnly, getMyAdmitCards);

// Staff routes
router.use(staffOnly);
router.post('/create', createAdmitCard);
router.get('/list', getAdmitCards);
router.post('/students', getStudentsForAdmitCard);
router.patch('/visibility/:id', toggleAdmitCardVisibility);
router.delete('/:id', deleteAdmitCard);

export default router;