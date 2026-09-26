import { Router } from 'express';
import {
  getInviteDetails,
  joinTeamByInvite
} from '../controllers/team.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

const requireParticipant = [authenticate, requireRole('participant')];

router.get('/:token', getInviteDetails);
router.post('/:token/join', ...requireParticipant, joinTeamByInvite);

export default router;
