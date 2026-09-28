import { Router } from 'express';
import {
  getJudgeScores,
  exportCSV,
  getJudgeProjects,
  submitScore,
  updateScore
} from '../controllers/judging.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/scores', authenticate, getJudgeScores);
router.get('/export.csv', authenticate, exportCSV);
router.get('/projects', authenticate, getJudgeProjects);
router.post('/scores', authenticate, submitScore);
router.put('/scores/:scoreId', authenticate, updateScore);

export default router;
