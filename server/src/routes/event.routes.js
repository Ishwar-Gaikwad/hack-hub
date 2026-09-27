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
import {
  castVote,
  retractVote,
  getVotingStatus,
  configureVoting,
  getBallot,
  getResults
} from '../controllers/voting.controller.js';
import {
  getComments,
  createComment
} from '../controllers/comment.controller.js';
import {
  getAuditLogs,
  getParticipationMetrics
} from '../controllers/audit.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { voteRateLimiter, commentRateLimiter } from '../middleware/rate-limit.middleware.js';

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

// Community Voting endpoints (T3)
router.get('/:eventId/voting', optionalAuthenticate, getVotingStatus);
router.put('/:eventId/voting', ...requireStaff, configureVoting);
router.post('/:eventId/projects/:projectId/vote', authenticate, voteRateLimiter, castVote);
router.delete('/:eventId/projects/:projectId/vote', authenticate, retractVote);
router.get('/:eventId/ballot', optionalAuthenticate, getBallot);
router.get('/:eventId/results', optionalAuthenticate, getResults);

// Project Comments endpoints (T3)
router.get('/:eventId/projects/:projectId/comments', optionalAuthenticate, getComments);
router.post('/:eventId/projects/:projectId/comments', authenticate, commentRateLimiter, createComment);

// Audit & Abuse Protection Metrics (T3 - Staff only)
router.get('/:eventId/audit-logs', ...requireStaff, getAuditLogs);
router.get('/:eventId/metrics', ...requireStaff, getParticipationMetrics);

export default router;

