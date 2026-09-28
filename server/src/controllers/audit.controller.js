import AuditLog from '../models/audit.model.js';
import Vote from '../models/vote.model.js';
import Comment from '../models/comment.model.js';
import Project from '../models/project.model.js';
import Event from '../models/event.model.js';
import { getVotingWindowStatus } from './voting.controller.js';

/**
 * Get audit logs for an event (Organizer/Admin only)
 * GET /api/events/:eventId/audit-logs
 */
export async function getAuditLogs(req, res) {
  const { eventId } = req.params;
  const { action, limit = 50, page = 1 } = req.query;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    if (req.user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view audit logs for events you host'
      });
    }

    const query = { eventId: event._id };
    if (action) {
      query.action = action;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'email role')
        .populate('projectId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return res.status(200).json({
      total,
      page: parsedPage,
      limit: parsedLimit,
      logs: logs.map(l => ({
        _id: l._id,
        action: l.action,
        actor: l.actorId ? { _id: l.actorId._id, email: l.actorId.email, role: l.actorId.role } : null,
        project: l.projectId ? { _id: l.projectId._id, title: l.projectId.title } : null,
        metadata: l.metadata,
        ip: l.ip,
        createdAt: l.createdAt
      }))
    });
  } catch (error) {
    console.error('[Audit Controller] Error fetching audit logs:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve audit logs' });
  }
}

/**
 * Get participation and abuse metrics (Organizer/Admin only)
 * GET /api/events/:eventId/metrics
 */
export async function getParticipationMetrics(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    if (req.user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view metrics for events you host'
      });
    }

    const [totalProjects, submittedProjects, totalVotes, uniqueVoters, totalComments, rateLimitEvents, duplicateAttempts] = await Promise.all([
      Project.countDocuments({ eventId: event._id }),
      Project.countDocuments({ eventId: event._id, status: 'submitted' }),
      Vote.countDocuments({ eventId: event._id }),
      Vote.distinct('voterId', { eventId: event._id }),
      Comment.countDocuments({ eventId: event._id }),
      AuditLog.countDocuments({ eventId: event._id, action: 'rate_limit.triggered' }),
      AuditLog.countDocuments({ eventId: event._id, action: 'duplicate_vote.attempted' })
    ]);

    const windowStatus = getVotingWindowStatus(event);

    return res.status(200).json({
      eventId: event._id,
      votingWindow: {
        isOpen: windowStatus.isOpen,
        status: windowStatus.reason,
        openAt: event.votingOpenAt,
        closeAt: event.votingCloseAt
      },
      participation: {
        totalProjects,
        submittedProjects,
        totalVotes,
        uniqueVoters: uniqueVoters.length,
        totalComments
      },
      security: {
        rateLimitTriggers: rateLimitEvents,
        duplicateVoteAttempts: duplicateAttempts
      }
    });
  } catch (error) {
    console.error('[Audit Controller] Error getting metrics:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve metrics' });
  }
}
