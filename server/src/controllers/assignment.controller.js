import mongoose from 'mongoose';
import crypto from 'crypto';
import Assignment from '../models/assignment.model.js';
import User from '../models/user.model.js';
import Event from '../models/event.model.js';
import Track from '../models/track.model.js';
import Project from '../models/project.model.js';
import Team from '../models/team.model.js';
import Score from '../models/score.model.js';
import AuditLog from '../models/audit.model.js';

/**
 * Helper to ensure event exists and organizer owns the event (unless admin)
 */
async function checkEventOrganizer(eventId, user) {
  const event = await Event.findById(eventId);
  if (!event) {
    return { error: { status: 404, error: 'NotFound', message: 'Event not found.' } };
  }
  if (user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== user._id.toString()) {
    return { error: { status: 403, error: 'Forbidden', message: 'You can only manage judges and results for events you host.' } };
  }
  return { event };
}

/**
 * GET /api/events/:eventId/judges
 * List all judges for an event with assignment details, progress, and status.
 */
export async function getEventJudges(req, res) {
  const { eventId } = req.params;

  try {
    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    // 1. Fetch submitted projects for this event
    const submittedProjects = await Project.find({ eventId, status: 'submitted' }).select('_id title trackId').lean();
    const totalSubmittedCount = submittedProjects.length;

    // 2. Fetch active assignments for this event
    const assignments = await Assignment.find({ eventId, status: 'active' })
      .populate('judgeId', 'name email role')
      .populate('trackId', 'name')
      .lean();

    // 3. Fetch all scores submitted for this event's submitted projects
    const submittedProjectIds = submittedProjects.map(p => p._id);
    const eventScores = await Score.find({ projectId: { $in: submittedProjectIds } }).select('judgeId projectId').lean();

    // Map scores by judgeId
    const scoresByJudge = new Map();
    for (const s of eventScores) {
      const jIdStr = s.judgeId.toString();
      if (!scoresByJudge.has(jIdStr)) scoresByJudge.set(jIdStr, new Set());
      scoresByJudge.get(jIdStr).add(s.projectId.toString());
    }

    // Build judge list from assignments
    const judgesList = [];
    const assignedJudgeIds = new Set();

    for (const a of assignments) {
      if (!a.judgeId) continue;
      const judgeIdStr = a.judgeId._id.toString();
      assignedJudgeIds.add(judgeIdStr);

      let targetProjectCount = totalSubmittedCount;
      if (a.trackId && !a.assignedAll) {
        targetProjectCount = submittedProjects.filter(p => p.trackId && p.trackId.toString() === a.trackId._id.toString()).length;
      } else if (a.projectIds?.length && !a.assignedAll) {
        targetProjectCount = a.projectIds.length;
      }

      const completedCount = scoresByJudge.get(judgeIdStr)?.size || 0;
      const remainingCount = Math.max(0, targetProjectCount - completedCount);

      let status = 'Pending';
      if (completedCount >= targetProjectCount && targetProjectCount > 0) {
        status = 'Completed';
      } else if (completedCount > 0) {
        status = 'In Progress';
      }

      judgesList.push({
        assignmentId: a._id,
        judgeId: a.judgeId._id,
        name: a.judgeId.name || a.judgeId.email.split('@')[0],
        email: a.judgeId.email,
        track: a.trackId ? { _id: a.trackId._id, name: a.trackId.name } : null,
        assignedProjectsCount: targetProjectCount,
        completedReviewsCount: completedCount,
        remainingReviewsCount: remainingCount,
        status,
        assignedAll: a.assignedAll,
        projectIds: a.projectIds || []
      });
    }

    // Also include judges who have submitted scores but don't have an explicit Assignment document
    for (const [judgeIdStr, scoredSet] of scoresByJudge.entries()) {
      if (!assignedJudgeIds.has(judgeIdStr)) {
        const judgeUser = await User.findById(judgeIdStr).select('name email role').lean();
        if (judgeUser) {
          const completedCount = scoredSet.size;
          const targetProjectCount = totalSubmittedCount;
          const remainingCount = Math.max(0, targetProjectCount - completedCount);
          const status = completedCount >= targetProjectCount && targetProjectCount > 0 ? 'Completed' : 'In Progress';

          judgesList.push({
            assignmentId: null,
            judgeId: judgeUser._id,
            name: judgeUser.name || judgeUser.email.split('@')[0],
            email: judgeUser.email,
            track: null,
            assignedProjectsCount: targetProjectCount,
            completedReviewsCount: completedCount,
            remainingReviewsCount: remainingCount,
            status,
            assignedAll: true,
            projectIds: []
          });
        }
      }
    }

    return res.status(200).json({ judges: judgesList });
  } catch (error) {
    console.error('[Assignment Controller] getEventJudges error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve judges.' });
  }
}

/**
 * POST /api/events/:eventId/judges/assign
 * Assign an existing judge to an event, optionally with a track or specific projects.
 */
export async function assignJudge(req, res) {
  const { eventId } = req.params;
  const { judgeId, trackId, projectIds, assignedAll } = req.body;

  try {
    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    if (!judgeId || !mongoose.Types.ObjectId.isValid(judgeId)) {
      return res.status(400).json({ error: 'BadRequest', message: 'Valid judge ID is required.' });
    }

    const judge = await User.findById(judgeId);
    if (!judge) {
      return res.status(404).json({ error: 'NotFound', message: 'Judge user not found.' });
    }

    // Prevent participant from judging their own event
    const participantTeam = await Team.findOne({ eventId, 'members.userId': judgeId });
    if (participantTeam) {
      return res.status(400).json({
        error: 'ConflictRole',
        message: 'User is registered as a participant in this event and cannot be assigned as a judge.'
      });
    }

    // Verify track belongs to this event if provided
    if (trackId) {
      if (!mongoose.Types.ObjectId.isValid(trackId)) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid track ID.' });
      }
      const track = await Track.findOne({ _id: trackId, eventId });
      if (!track) {
        return res.status(400).json({ error: 'BadRequest', message: 'Track does not belong to this event.' });
      }
    }

    // Verify projectIds belong to this event if provided
    if (projectIds && Array.isArray(projectIds) && projectIds.length > 0 && !assignedAll) {
      for (const pId of projectIds) {
        if (!mongoose.Types.ObjectId.isValid(pId)) {
          return res.status(400).json({ error: 'BadRequest', message: `Invalid project ID: ${pId}` });
        }
      }
      const validProjects = await Project.find({ _id: { $in: projectIds }, eventId });
      if (validProjects.length !== projectIds.length) {
        return res.status(400).json({ error: 'BadRequest', message: 'One or more projects do not belong to this event.' });
      }
    }

    // Prevent duplicate active assignment
    const existing = await Assignment.findOne({ eventId, judgeId, status: 'active' });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Judge is already actively assigned to this event.' });
    }

    // Ensure user has judge role
    if (judge.role !== 'judge' && judge.role !== 'admin') {
      judge.role = 'judge';
      await judge.save();
    }

    const assignment = await Assignment.create({
      eventId,
      judgeId,
      trackId: trackId || null,
      projectIds: (projectIds && Array.isArray(projectIds)) ? projectIds : [],
      assignedAll: Boolean(assignedAll),
      status: 'active',
      assignedBy: req.user._id
    });

    await AuditLog.create({
      action: 'judge.assigned',
      actorId: req.user._id,
      eventId,
      metadata: {
        judgeId: judge._id,
        judgeEmail: judge.email,
        trackId: trackId || null,
        assignedAll: Boolean(assignedAll)
      }
    }).catch(() => {});

    return res.status(201).json({
      message: 'Judge assigned successfully',
      assignment
    });
  } catch (error) {
    console.error('[Assignment Controller] assignJudge error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to assign judge.' });
  }
}

/**
 * POST /api/events/:eventId/judges/invite
 * Invite a judge via email and assign them to the event.
 */
export async function inviteJudge(req, res) {
  const { eventId } = req.params;
  const { email, name, trackId, projectIds, assignedAll } = req.body;

  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'BadRequest', message: 'Valid email address is required.' });
    }

    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    // Verify track if provided
    if (trackId) {
      const track = await Track.findOne({ _id: trackId, eventId });
      if (!track) {
        return res.status(400).json({ error: 'BadRequest', message: 'Track does not belong to this event.' });
      }
    }

    // Verify projects if provided
    if (projectIds && Array.isArray(projectIds) && projectIds.length > 0 && !assignedAll) {
      const validProjects = await Project.find({ _id: { $in: projectIds }, eventId });
      if (validProjects.length !== projectIds.length) {
        return res.status(400).json({ error: 'BadRequest', message: 'One or more projects do not belong to this event.' });
      }
    }

    const normalizedEmail = email.trim().toLowerCase();
    let judge = await User.findOne({ email: normalizedEmail });

    if (judge) {
      // Check participant conflict
      const participantTeam = await Team.findOne({ eventId, 'members.userId': judge._id });
      if (participantTeam) {
        return res.status(400).json({
          error: 'ConflictRole',
          message: 'User is registered as a participant in this event and cannot be assigned as a judge.'
        });
      }

      // Check duplicate assignment
      const existing = await Assignment.findOne({ eventId, judgeId: judge._id, status: 'active' });
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'Judge is already actively assigned to this event.' });
      }

      if (judge.role !== 'judge' && judge.role !== 'admin') {
        judge.role = 'judge';
        await judge.save();
      }
    } else {
      // Create new judge user for offline / local workflow
      judge = await User.create({
        email: normalizedEmail,
        name: (name && name.trim()) || normalizedEmail.split('@')[0],
        role: 'judge',
        password: crypto.randomBytes(8).toString('hex')
      });
    }

    const assignment = await Assignment.create({
      eventId,
      judgeId: judge._id,
      trackId: trackId || null,
      projectIds: (projectIds && Array.isArray(projectIds)) ? projectIds : [],
      assignedAll: Boolean(assignedAll),
      status: 'active',
      assignedBy: req.user._id
    });

    const inviteToken = crypto.randomBytes(16).toString('hex');

    await AuditLog.create({
      action: 'judge.invited',
      actorId: req.user._id,
      eventId,
      metadata: {
        judgeId: judge._id,
        judgeEmail: judge.email,
        trackId: trackId || null,
        assignedAll: Boolean(assignedAll)
      }
    }).catch(() => {});

    return res.status(201).json({
      message: 'Judge invited and assigned successfully',
      judge: { _id: judge._id, name: judge.name, email: judge.email },
      assignment,
      inviteToken,
      inviteLink: `/invite/judge/${inviteToken}`
    });
  } catch (error) {
    console.error('[Assignment Controller] inviteJudge error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to invite judge.' });
  }
}

/**
 * DELETE /api/events/:eventId/judges/:judgeId/assignment
 * Revoke a judge's active assignment.
 */
export async function revokeAssignment(req, res) {
  const { eventId, judgeId } = req.params;

  try {
    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const assignment = await Assignment.findOne({ eventId, judgeId, status: 'active' });
    if (!assignment) {
      return res.status(404).json({ error: 'NotFound', message: 'Active assignment not found for this judge in this event.' });
    }

    assignment.status = 'revoked';
    await assignment.save();

    await AuditLog.create({
      action: 'judge.assignment_revoked',
      actorId: req.user._id,
      eventId,
      metadata: { judgeId }
    }).catch(() => {});

    return res.status(200).json({ message: 'Judge assignment revoked successfully.' });
  } catch (error) {
    console.error('[Assignment Controller] revokeAssignment error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to revoke judge assignment.' });
  }
}

/**
 * GET /api/events/:eventId/judges/available
 * List users available to be assigned as judges for this event.
 */
export async function getAvailableJudges(req, res) {
  const { eventId } = req.params;

  try {
    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const activeAssignments = await Assignment.find({ eventId, status: 'active' }).select('judgeId').lean();
    const assignedJudgeIds = new Set(activeAssignments.map(a => a.judgeId.toString()));

    const participantTeams = await Team.find({ eventId }).select('members.userId').lean();
    const participantUserIds = new Set();
    for (const t of participantTeams) {
      for (const m of (t.members || [])) {
        if (m.userId) participantUserIds.add(m.userId.toString());
      }
    }

    const judges = await User.find({
      role: { $in: ['judge', 'admin'] }
    }).select('_id name email role').lean();

    const available = judges.filter(j => !assignedJudgeIds.has(j._id.toString()) && !participantUserIds.has(j._id.toString()));

    return res.status(200).json({ availableJudges: available });
  } catch (error) {
    console.error('[Assignment Controller] getAvailableJudges error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve available judges.' });
  }
}

/**
 * POST /api/events/:eventId/results/publish
 * Publish final hackathon results with confirmation and warning acknowledgment.
 */
export async function publishResults(req, res) {
  const { eventId } = req.params;
  const { acknowledgeWarnings = false } = req.body;

  try {
    const { event, error } = await checkEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const projects = await Project.find({ eventId, status: 'submitted' }).select('_id').lean();
    const projectIds = projects.map(p => p._id);

    const scores = await Score.find({ projectId: { $in: projectIds } }).lean();
    const scoresByProject = new Map();
    for (const s of scores) {
      const pId = s.projectId.toString();
      if (!scoresByProject.has(pId)) scoresByProject.set(pId, []);
      scoresByProject.get(pId).push(s);
    }

    let unreviewedCount = 0;
    let discrepancyCount = 0;

    for (const pId of projectIds) {
      const pScores = scoresByProject.get(pId.toString()) || [];
      if (pScores.length < 2) {
        unreviewedCount += 1;
      }
      if (pScores.length >= 2) {
        for (let i = 0; i < pScores.length; i++) {
          for (let j = i + 1; j < pScores.length; j++) {
            const cA = pScores[i].criteria || {};
            const cB = pScores[j].criteria || {};
            const dims = ['technicalInnovation', 'execution', 'design', 'impact', 'documentation'];
            for (const d of dims) {
              if (cA[d] !== undefined && cB[d] !== undefined && Math.abs(cA[d] - cB[d]) > 2.0) {
                discrepancyCount += 1;
                break;
              }
            }
          }
        }
      }
    }

    const totalWarnings = unreviewedCount + discrepancyCount;

    if (totalWarnings > 0 && !acknowledgeWarnings) {
      return res.status(400).json({
        error: 'UnresolvedWarnings',
        message: `There are ${totalWarnings} unresolved warnings (${unreviewedCount} projects with insufficient reviews, ${discrepancyCount} discrepancy warnings). You must explicitly acknowledge these warnings to publish results.`,
        warnings: { unreviewedCount, discrepancyCount }
      });
    }

    event.resultsPublished = true;
    event.resultsPublishedAt = new Date();
    await event.save();

    await AuditLog.create({
      action: 'results.published',
      actorId: req.user._id,
      eventId,
      metadata: {
        totalProjects: projects.length,
        totalScores: scores.length,
        unreviewedCount,
        discrepancyCount,
        acknowledged: Boolean(acknowledgeWarnings)
      }
    }).catch(() => {});

    return res.status(200).json({
      message: 'Hackathon results published successfully.',
      resultsPublished: true,
      resultsPublishedAt: event.resultsPublishedAt,
      warnings: { unreviewedCount, discrepancyCount }
    });
  } catch (error) {
    console.error('[Assignment Controller] publishResults error:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to publish results.' });
  }
}
