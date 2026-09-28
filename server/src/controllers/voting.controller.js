import crypto from 'crypto';
import mongoose from 'mongoose';
import Event from '../models/event.model.js';
import Project from '../models/project.model.js';
import Vote from '../models/vote.model.js';
import AuditLog from '../models/audit.model.js';

/**
 * Deterministic PRNG: Mulberry32
 * Generates a pseudo-random number between 0 and 1 given a 32-bit integer seed
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string to a 32-bit integer
 */
function hashStringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

/**
 * Helper to determine if voting is currently open for an event
 */
export function getVotingWindowStatus(event) {
  const now = new Date();
  const openAt = event.votingOpenAt ? new Date(event.votingOpenAt) : null;
  const closeAt = event.votingCloseAt ? new Date(event.votingCloseAt) : null;

  if (openAt && now < openAt) {
    return { isOpen: false, reason: 'not_started', openAt, closeAt };
  }
  if (closeAt && now > closeAt) {
    return { isOpen: false, reason: 'ended', openAt, closeAt };
  }
  if (!openAt && !closeAt) {
    // If no explicit window configured, voting is active if event is not closed
    const isOpen = event.status !== 'closed';
    return { isOpen, reason: isOpen ? 'active' : 'event_closed', openAt: null, closeAt: null };
  }
  return { isOpen: true, reason: 'active', openAt, closeAt };
}

/**
 * Cast a community vote for a project
 * POST /api/events/:eventId/projects/:projectId/vote
 */
export async function castVote(req, res) {
  const { eventId, projectId } = req.params;
  const voterId = req.user._id;
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'EventNotFound',
        message: `Event ${eventId} does not exist`
      });
    }

    // Check voting window
    const windowStatus = getVotingWindowStatus(event);
    if (!windowStatus.isOpen) {
      await AuditLog.create({
        action: 'vote.rejected',
        actorId: voterId,
        eventId: event._id,
        projectId: new mongoose.Types.ObjectId(projectId),
        metadata: { reason: windowStatus.reason },
        ip: String(clientIp)
      });

      return res.status(400).json({
        error: 'VotingNotAllowed',
        message: windowStatus.reason === 'not_started'
          ? `Voting opens on ${windowStatus.openAt.toISOString()}`
          : 'Community voting has closed for this event',
        status: windowStatus.reason
      });
    }

    // Validate project existence, status, and event membership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'ProjectNotFound',
        message: `Project ${projectId} does not exist`
      });
    }

    if (project.eventId.toString() !== event._id.toString()) {
      return res.status(400).json({
        error: 'EventMismatch',
        message: 'Project does not belong to the specified event'
      });
    }

    if (project.status !== 'submitted') {
      return res.status(400).json({
        error: 'InvalidProjectStatus',
        message: 'Only submitted projects can receive community votes'
      });
    }

    // Attempt to persist the vote (atomic uniqueness enforced by DB compound index)
    try {
      const vote = await Vote.create({
        eventId: event._id,
        projectId: project._id,
        voterId
      });

      await AuditLog.create({
        action: 'vote.created',
        actorId: voterId,
        eventId: event._id,
        projectId: project._id,
        metadata: { voteId: vote._id },
        ip: String(clientIp)
      });

      return res.status(201).json({
        message: 'Vote recorded successfully',
        voteId: vote._id,
        projectId: project._id,
        eventId: event._id
      });
    } catch (dbError) {
      // MongoDB duplicate key error code 11000
      if (dbError.code === 11000 || dbError.name === 'MongoServerError') {
        await AuditLog.create({
          action: 'duplicate_vote.attempted',
          actorId: voterId,
          eventId: event._id,
          projectId: project._id,
          metadata: { reason: 'unique_constraint_violation' },
          ip: String(clientIp)
        });

        return res.status(409).json({
          error: 'DuplicateVote',
          message: 'You have already voted for this project'
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('[Voting Controller] Error casting vote:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to record vote'
    });
  }
}

/**
 * Retract / delete an existing vote
 * DELETE /api/events/:eventId/projects/:projectId/vote
 */
export async function retractVote(req, res) {
  const { eventId, projectId } = req.params;
  const voterId = req.user._id;
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const windowStatus = getVotingWindowStatus(event);
    if (!windowStatus.isOpen && windowStatus.reason === 'ended') {
      return res.status(400).json({
        error: 'VotingClosed',
        message: 'Cannot retract votes after voting has closed'
      });
    }

    const deleted = await Vote.findOneAndDelete({
      eventId,
      projectId,
      voterId
    });

    if (!deleted) {
      return res.status(404).json({
        error: 'VoteNotFound',
        message: 'No existing vote found for this project by the current user'
      });
    }

    await AuditLog.create({
      action: 'vote.retracted',
      actorId: voterId,
      eventId: event._id,
      projectId: new mongoose.Types.ObjectId(projectId),
      metadata: { previousVoteId: deleted._id },
      ip: String(clientIp)
    });

    return res.status(200).json({
      message: 'Vote retracted successfully',
      projectId,
      eventId
    });
  } catch (error) {
    console.error('[Voting Controller] Error retracting vote:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retract vote'
    });
  }
}

/**
 * Get voting status and user votes
 * GET /api/events/:eventId/voting
 */
export async function getVotingStatus(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const windowStatus = getVotingWindowStatus(event);
    const response = {
      eventId: event._id,
      isOpen: windowStatus.isOpen,
      reason: windowStatus.reason,
      votingOpenAt: event.votingOpenAt,
      votingCloseAt: event.votingCloseAt,
      userVotes: []
    };

    if (req.user) {
      const votes = await Vote.find({ eventId: event._id, voterId: req.user._id }).select('projectId');
      response.userVotes = votes.map(v => v.projectId.toString());
    }

    const isStaff = req.user && ['organizer', 'admin'].includes(req.user.role);
    if (isStaff || !windowStatus.isOpen) {
      response.totalVotes = await Vote.countDocuments({ eventId: event._id });
      const uniqueVoters = await Vote.distinct('voterId', { eventId: event._id });
      response.totalVoters = uniqueVoters.length;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Voting Controller] Error getting voting status:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve voting status' });
  }
}

/**
 * Randomized Ballot: return submitted projects in a deterministic shuffled order per voter/session
 * GET /api/events/:eventId/ballot
 */
export async function getBallot(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const projects = await Project.find({ eventId: event._id, status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .lean();

    // Generate stable deterministic seed for this voter/session + event
    const voterIdentifier = req.user
      ? req.user._id.toString()
      : (req.headers['x-session-token'] || req.ip || 'anonymous-voter');

    const seedString = `${event._id.toString()}-${voterIdentifier}`;
    const seedInt = hashStringToSeed(seedString);
    const rng = mulberry32(seedInt);

    // Fisher-Yates shuffle using deterministic PRNG
    const shuffled = [...projects];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Attach user voted status if logged in
    let votedSet = new Set();
    if (req.user) {
      const userVotes = await Vote.find({ eventId: event._id, voterId: req.user._id }).select('projectId');
      votedSet = new Set(userVotes.map(v => v.projectId.toString()));
    }

    const ballot = shuffled.map(p => ({
      _id: p._id,
      title: p.title,
      description: p.description,
      repositoryUrl: p.repositoryUrl,
      team: p.teamId?.name || 'Independent',
      track: p.trackId?.name || 'General',
      hasVoted: votedSet.has(p._id.toString())
    }));

    return res.status(200).json({
      eventId: event._id,
      count: ballot.length,
      ballotOrder: ballot
    });
  } catch (error) {
    console.error('[Voting Controller] Error getting ballot:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to generate ballot' });
  }
}

/**
 * Public Vote Results
 * GET /api/events/:eventId/results
 * Server-side privacy enforcement: Hides live totals while voting is open unless requester is staff
 */
export async function getResults(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const windowStatus = getVotingWindowStatus(event);
    const isStaff = req.user && ['organizer', 'admin'].includes(req.user.role);

    // If voting has not started yet and requester is NOT staff, keep results sealed
    if (windowStatus.reason === 'not_started' && !isStaff) {
      return res.status(200).json({
        status: 'voting_not_started',
        message: 'Community voting has not started yet. Results will be published after voting concludes.',
        votingOpenAt: event.votingOpenAt,
        resultsHidden: true
      });
    }

    // If voting is actively open and requester is NOT staff, hide live vote totals & rankings!
    if (windowStatus.isOpen && !isStaff) {
      return res.status(200).json({
        status: 'voting_in_progress',
        message: 'Community voting is currently active. Vote counts and rankings are private until voting closes.',
        votingCloseAt: event.votingCloseAt,
        resultsHidden: true
      });
    }

    // Voting is closed OR requester is staff -> Aggregate results
    const voteAggregates = await Vote.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: '$projectId', voteCount: { $sum: 1 } } },
      { $sort: { voteCount: -1 } }
    ]);

    const voteCountMap = new Map();
    voteAggregates.forEach(va => voteCountMap.set(va._id.toString(), va.voteCount));

    const submittedProjects = await Project.find({ eventId: event._id, status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .lean();

    const rankedProjects = submittedProjects
      .map(p => ({
        projectId: p._id,
        title: p.title,
        teamName: p.teamId?.name || 'Independent',
        trackName: p.trackId?.name || 'General',
        votes: voteCountMap.get(p._id.toString()) || 0
      }))
      .sort((a, b) => b.votes - a.votes)
      .map((p, index) => ({
        ...p,
        rank: index + 1
      }));

    const totalVotes = await Vote.countDocuments({ eventId: event._id });
    const uniqueVoters = await Vote.distinct('voterId', { eventId: event._id });

    return res.status(200).json({
      status: windowStatus.isOpen ? 'in_progress_staff_view' : 'published',
      isStaffView: isStaff && windowStatus.isOpen,
      eventId: event._id,
      totalVotes,
      totalVoters: uniqueVoters.length,
      results: rankedProjects
    });
  } catch (error) {
    console.error('[Voting Controller] Error retrieving results:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve results' });
  }
}

/**
 * Configure voting window
 * PUT /api/events/:eventId/voting
 */
export async function configureVoting(req, res) {
  const { eventId } = req.params;
  const { votingOpenAt, votingCloseAt } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    if (votingOpenAt !== undefined) {
      event.votingOpenAt = votingOpenAt ? new Date(votingOpenAt) : null;
    }
    if (votingCloseAt !== undefined) {
      event.votingCloseAt = votingCloseAt ? new Date(votingCloseAt) : null;
    }

    await event.save();

    await AuditLog.create({
      action: 'voting.configured',
      actorId: req.user._id,
      eventId: event._id,
      metadata: { votingOpenAt: event.votingOpenAt, votingCloseAt: event.votingCloseAt },
      ip: String(req.ip || '127.0.0.1')
    });

    return res.status(200).json({
      message: 'Voting window configured successfully',
      event: {
        _id: event._id,
        votingOpenAt: event.votingOpenAt,
        votingCloseAt: event.votingCloseAt
      }
    });
  } catch (error) {
    console.error('[Voting Controller] Error configuring voting:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to configure voting window' });
  }
}
