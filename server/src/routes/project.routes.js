import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  getMyProjects,
  updateProject,
  submitProject
} from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

const requireParticipant = [authenticate, requireRole('participant')];

// Public Gallery endpoints (No authentication required)
router.get('/', getProjects);
router.get('/gallery', getProjects);

// Project endpoints
router.get('/my-projects', authenticate, getMyProjects);
router.post('/', ...requireParticipant, createProject);
router.post('/new', ...requireParticipant, createProject);
router.get('/:id', getProjectById);
router.put('/:id', ...requireParticipant, updateProject);
router.post('/:id/submit', ...requireParticipant, submitProject);

export default router;

