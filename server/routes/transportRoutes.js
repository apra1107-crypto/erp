import express from 'express';
import { 
    getBuses, addBus, updateBus, deleteBus, 
    getStops, saveStops, syncManifest,
    getPublicBusManifest, markStudentBoarding, getTransportLogs, getPublicLogs
} from '../controllers/transportController.js';
import { protect, principalOrSpecialTeacher, staffOnly, studentOnly } from '../middlewares/auth.js';

const router = express.Router();

router.get('/list', protect, (req, res, next) => {
    // Allow Principal, Staff, and Students to see the list
    next();
}, getBuses);
router.post('/add', protect, principalOrSpecialTeacher, addBus);
router.put('/update/:id', protect, principalOrSpecialTeacher, updateBus);
router.delete('/delete/:id', protect, principalOrSpecialTeacher, deleteBus);
router.get('/stops/:busId', protect, principalOrSpecialTeacher, getStops);
router.post('/stops/:busId', protect, principalOrSpecialTeacher, saveStops);
router.get('/assignments/:busId', protect, principalOrSpecialTeacher, (req, res, next) => {
    import('../controllers/transportController.js').then(m => m.getStopAssignments(req, res)).catch(next);
});
router.post('/sync-manifest/:busId', protect, principalOrSpecialTeacher, (req, res, next) => {
    import('../controllers/transportController.js').then(m => m.syncManifest(req, res)).catch(next);
});

// Real-time tracking & public access
router.get('/public/manifest/:busId', getPublicBusManifest);
router.post('/public/mark-status/:busId', markStudentBoarding);
router.get('/public/logs-mini/:busId', (req, res, next) => {
    import('../controllers/transportController.js').then(m => m.getPublicLogs(req, res)).catch(next);
});
router.get('/logs/:busId', protect, (req, res, next) => {
    // Allow Principal, Staff, and Students to see logs
    next();
}, getTransportLogs);

export default router;
