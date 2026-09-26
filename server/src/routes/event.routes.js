import { Router } from 'express';
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent
} from '../controllers/event.controller.js';
import {
  createTrack,
  getTracksByEvent,
  updateTrack
} from '../controllers/track.controller.js';
import {
  createPrize,
  getPrizesByEvent,
  updatePrize
} from '../controllers/prize.controller.js';
import {
  createTeam,
  getTeamsByEvent
} from '../controllers/team.controller.js';
import { createProject, getProjects } from '../controllers/project.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Middleware shortcuts
const requireStaff = [authenticate, requireRole('organizer', 'admin')];
const requireParticipant = [authenticate, requireRole('participant')];

// Event endpoints
router.get('/', getEvents);
router.post('/', ...requireStaff, createEvent);
router.get('/:id', getEventById);
router.put('/:id', ...requireStaff, updateEvent);

// Track endpoints (nested under event)
router.get('/:eventId/tracks', getTracksByEvent);
router.post('/:eventId/tracks', ...requireStaff, createTrack);
router.put('/:eventId/tracks/:trackId', ...requireStaff, updateTrack);

// Prize endpoints (nested under event)
router.get('/:eventId/prizes', getPrizesByEvent);
router.post('/:eventId/prizes', ...requireStaff, createPrize);
router.put('/:eventId/prizes/:prizeId', ...requireStaff, updatePrize);

// Team endpoints (nested under event)
router.get('/:eventId/teams', getTeamsByEvent);
router.post('/:eventId/teams', ...requireParticipant, createTeam);

// Project endpoints (nested under event)
router.get('/:eventId/projects', getProjects);
router.post('/:eventId/projects', ...requireParticipant, createProject);

export default router;

