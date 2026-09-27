import { Router } from 'express';
import { getJudgeScores, exportCSV } from '../controllers/judging.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/scores', authenticate, getJudgeScores);
router.get('/export.csv', authenticate, exportCSV);

export default router;
