import { Router } from 'express';
import {
  createTeam,
  getTeamsByEvent,
  getTeamById,
  getMyTeams,
  generateInvite,
  joinTeamByInvite,
  getInviteDetails
} from '../controllers/team.controller.js';
import { getProjectByTeam } from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Participant authentication middleware shortcut
const requireParticipant = [authenticate, requireRole('participant')];

// Team routes
router.get('/my-teams', authenticate, getMyTeams);
router.post('/join', ...requireParticipant, joinTeamByInvite);
router.get('/:id', getTeamById);
router.get('/:teamId/project', getProjectByTeam);
router.post('/:id/invites', ...requireParticipant, generateInvite);

export default router;
