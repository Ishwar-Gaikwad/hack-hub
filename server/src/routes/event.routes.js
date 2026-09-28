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
import {
  createWebhook,
  getWebhooks,
  deleteWebhook,
  testWebhook
} from '../controllers/webhook.controller.js';
import {
  getEventCertificates,
  getCertificate
} from '../controllers/certificate.controller.js';
import {
  getJudgingRecord,
  verifyRecord
} from '../controllers/record.controller.js';
import {
  bulkImport,
  bulkExportFull,
  bulkExportCSV
} from '../controllers/bulk.controller.js';
import { getOrganizerJudgingOverview } from '../controllers/judging.controller.js';
import {
  getEventJudges,
  assignJudge,
  inviteJudge,
  revokeAssignment,
  getAvailableJudges,
  publishResults
} from '../controllers/assignment.controller.js';
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

// Judging & Fairness Overview (T2 - Staff only)
router.get('/:eventId/judging/overview', ...requireStaff, getOrganizerJudgingOverview);

// Judge Assignment & Invitation endpoints (Organizer / Staff only)
router.get('/:eventId/judges', ...requireStaff, getEventJudges);
router.get('/:eventId/judges/available', ...requireStaff, getAvailableJudges);
router.post('/:eventId/judges/assign', ...requireStaff, assignJudge);
router.post('/:eventId/judges/invite', ...requireStaff, inviteJudge);
router.delete('/:eventId/judges/:judgeId/assignment', ...requireStaff, revokeAssignment);

// Results Publishing (Staff only)
router.post('/:eventId/results/publish', ...requireStaff, publishResults);

// Event Webhooks (T4)
router.post('/:eventId/webhooks', ...requireStaff, createWebhook);
router.get('/:eventId/webhooks', ...requireStaff, getWebhooks);
router.delete('/:eventId/webhooks/:webhookId', ...requireStaff, deleteWebhook);
router.post('/:eventId/webhooks/:webhookId/test', ...requireStaff, testWebhook);

// Verifiable Certificates (T4)
router.get('/:eventId/certificates', optionalAuthenticate, getEventCertificates);
router.get('/:eventId/certificates/:type/:recipientId', optionalAuthenticate, getCertificate);

// Verifiable Judging Records (T4)
router.get('/:eventId/records/judging', optionalAuthenticate, getJudgingRecord);
router.post('/:eventId/records/verify', verifyRecord);

// Bulk Import & Export (T4)
router.post('/:eventId/import', ...requireStaff, bulkImport);
router.get('/:eventId/export/full', ...requireStaff, bulkExportFull);
router.get('/:eventId/export/csv', ...requireStaff, bulkExportCSV);

export default router;

