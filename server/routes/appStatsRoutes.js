import express from 'express';
import { getDownloadCount, incrementDownloadCount } from '../controllers/appStatsController.js';

const router = express.Router();

router.get('/download-count', getDownloadCount);
router.post('/increment-download', incrementDownloadCount);

export default router;
