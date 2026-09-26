import mongoose from 'mongoose';
import Team from '../models/team.model.js';
import Event from '../models/event.model.js';
import Invitation from '../models/invitation.model.js';

/**
 * Create a new team for an event
 * POST /api/events/:eventId/teams
 */
export async function createTeam(req, res) {
  try {
    const { eventId } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Team name is required and must be at least 2 characters long.'
      });
    }

    const normalizedName = name.trim();

    // Create team with creator as first member with 'owner' role
    const team = await Team.create({
      eventId,
      name: normalizedName,
      creatorId: req.user._id,
      members: [
        {
          userId: req.user._id,
          role: 'owner',
          joinedAt: new Date()
        }
      ]
    });

    const populatedTeam = await Team.findById(team._id).populate('members.userId', 'email role');

    return res.status(201).json({
      message: 'Team created successfully',
      team: populatedTeam.toJSON()
    });
  } catch (error) {
    console.error('[Team Controller] Create error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create team.'
    });
  }
}

/**
 * Get all teams for an event
 * GET /api/events/:eventId/teams
 */
export async function getTeamsByEvent(req, res) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    const teams = await Team.find({ eventId })
      .populate('members.userId', 'email role')
      .populate('creatorId', 'email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      teams
    });
  } catch (error) {
    console.error('[Team Controller] GetTeamsByEvent error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve teams.'
    });
  }
}

/**
 * Get specific team by ID
 * GET /api/teams/:id
 */
export async function getTeamById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid team ID format.'
      });
    }

    const team = await Team.findById(id)
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate('members.userId', 'email role')
      .populate('creatorId', 'email role');

    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Team not found.'
      });
    }

    return res.status(200).json({
      team: team.toJSON()
    });
  } catch (error) {
    console.error('[Team Controller] GetTeamById error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve team.'
    });
  }
}

/**
 * Get current authenticated user's teams
 * GET /api/teams/my-teams
 */
export async function getMyTeams(req, res) {
  try {
    const teams = await Team.find({ 'members.userId': req.user._id })
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate('members.userId', 'email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      teams
    });
  } catch (error) {
    console.error('[Team Controller] GetMyTeams error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve user teams.'
    });
  }
}

/**
 * Generate an invite link/token for a team
 * POST /api/teams/:id/invites
 */
export async function generateInvite(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid team ID format.'
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Team not found.'
      });
    }

    // Verify user is a member of this team
    const isMember = team.members.some((m) => m.userId.equals(req.user._id));
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You must be a member of this team to generate an invitation.'
      });
    }

    const invitation = await Invitation.createInvitation(team._id, team.eventId, req.user._id);

    return res.status(201).json({
      message: 'Invitation generated successfully',
      invitation: {
        token: invitation.token,
        teamId: invitation.teamId,
        eventId: invitation.eventId,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('[Team Controller] GenerateInvite error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to generate invitation.'
    });
  }
}

/**
 * Join a team using an invite token
 * POST /api/teams/join or POST /api/invites/:token/join
 */
export async function joinTeamByInvite(req, res) {
  try {
    const token = req.body.token || req.params.token;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invitation token is required.'
      });
    }

    const invitation = await Invitation.findOne({ token, isValid: true });
    if (!invitation) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Invalid or revoked invitation token.'
      });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'This invitation token has expired.'
      });
    }

    const team = await Team.findById(invitation.teamId);
    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'The team associated with this invitation was not found.'
      });
    }

    // Check if user is already a member of this team
    const isAlreadyMember = team.members.some((m) => m.userId.equals(req.user._id));
    if (isAlreadyMember) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You are already a member of this team.'
      });
    }

    // Add user as member
    team.members.push({
      userId: req.user._id,
      role: 'member',
      joinedAt: new Date()
    });

    await team.save();

    // Increment invitation usage
    invitation.usedCount += 1;
    await invitation.save();

    const populatedTeam = await Team.findById(team._id)
      .populate('eventId', 'name')
      .populate('members.userId', 'email role');

    return res.status(200).json({
      message: 'Successfully joined the team',
      team: populatedTeam.toJSON()
    });
  } catch (error) {
    console.error('[Team Controller] JoinTeam error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to join team.'
    });
  }
}

/**
 * Inspect invitation details
 * GET /api/invites/:token
 */
export async function getInviteDetails(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invitation token is required.'
      });
    }

    const invitation = await Invitation.findOne({ token, isValid: true })
      .populate('teamId', 'name members')
      .populate('eventId', 'name startDate submissionDeadline endDate');

    if (!invitation) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Invalid or expired invitation token.'
      });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'This invitation token has expired.'
      });
    }

    return res.status(200).json({
      invitation: {
        token: invitation.token,
        team: {
          id: invitation.teamId._id,
          name: invitation.teamId.name,
          memberCount: invitation.teamId.members.length
        },
        event: invitation.eventId,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('[Team Controller] GetInviteDetails error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to inspect invitation.'
    });
  }
}

export default {
  createTeam,
  getTeamsByEvent,
  getTeamById,
  getMyTeams,
  generateInvite,
  joinTeamByInvite,
  getInviteDetails
};
