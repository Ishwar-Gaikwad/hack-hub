import mongoose from 'mongoose';
import Project from '../models/project.model.js';
import Event from '../models/event.model.js';
import Team from '../models/team.model.js';
import Track from '../models/track.model.js';

/**
 * Create a project in draft status
 * POST /api/projects or POST /api/events/:eventId/projects
 */
export async function createProject(req, res) {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const { teamId, trackId, title, description, repositoryUrl } = req.body;

    // Validate ObjectIds
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'A valid event ID is required.'
      });
    }

    if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'A valid team ID is required.'
      });
    }

    if (!trackId || !mongoose.Types.ObjectId.isValid(trackId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'A valid track ID is required.'
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Project title is required and must be at least 2 characters long.'
      });
    }

    // Verify Event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    // Verify Team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Team not found.'
      });
    }

    // Verify Team belongs to this Event
    if (team.eventId.toString() !== event._id.toString()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'The specified team does not belong to this event.'
      });
    }

    // Verify Authenticated User belongs to the Team
    const isMember = team.members.some((m) => m.userId.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You must be a member of this team to create a project.'
      });
    }

    // Verify Track exists and belongs to the same Event
    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Track not found.'
      });
    }

    if (track.eventId.toString() !== event._id.toString()) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'The specified track does not belong to this event.'
      });
    }

    // Check if team already has a project in this event
    const existingProject = await Project.findOne({ eventId, teamId });
    if (existingProject) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A project already exists for this team in this event.'
      });
    }

    // Enforce submission deadline on project creation
    if (event.submissionDeadline && new Date().getTime() > new Date(event.submissionDeadline).getTime()) {
      return res.status(400).json({
        error: 'DeadlineExceeded',
        message: 'The submission deadline for this event has passed. Project creation is closed.'
      });
    }

    const project = await Project.create({
      eventId,
      teamId,
      trackId,
      title: title.trim(),
      description: description ? String(description).trim() : '',
      repositoryUrl: repositoryUrl ? String(repositoryUrl).trim() : '',
      status: 'draft'
    });

    const populatedProject = await Project.findById(project._id)
      .populate('eventId', 'name status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description');

    return res.status(201).json({
      message: 'Project created successfully as draft',
      project: populatedProject.toJSON()
    });
  } catch (error) {
    console.error('[Project Controller] Create error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create project.'
    });
  }
}

/**
 * Get single project by ID
 * GET /api/projects/:id
 */
export async function getProjectById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id)
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description');

    if (!project) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Project not found.'
      });
    }

    return res.status(200).json({
      project: project.toJSON()
    });
  } catch (error) {
    console.error('[Project Controller] GetById error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve project.'
    });
  }
}

/**
 * Get project by team ID
 * GET /api/teams/:teamId/project
 */
export async function getProjectByTeam(req, res) {
  try {
    const { teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid team ID format.'
      });
    }

    const project = await Project.findOne({ teamId })
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description');

    if (!project) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'No project found for this team.'
      });
    }

    return res.status(200).json({
      project: project.toJSON()
    });
  } catch (error) {
    console.error('[Project Controller] GetByTeam error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve team project.'
    });
  }
}

/**
 * Get current user's projects across teams they belong to
 * GET /api/projects/my-projects
 */
export async function getMyProjects(req, res) {
  try {
    const userTeams = await Team.find({ 'members.userId': req.user._id }).select('_id');
    const teamIds = userTeams.map((t) => t._id);

    const projects = await Project.find({ teamId: { $in: teamIds } })
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      projects
    });
  } catch (error) {
    console.error('[Project Controller] GetMyProjects error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve your projects.'
    });
  }
}

/**
 * Edit / Update project
 * PUT /api/projects/:id
 */
export async function updateProject(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Project not found.'
      });
    }

    // Verify authenticated user is member of project's team
    const team = await Team.findById(project.teamId);
    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Associated team not found.'
      });
    }

    const isMember = team.members.some((m) => m.userId.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only members of this team can edit this project.'
      });
    }

    // Enforce submission deadline on project editing
    const event = await Event.findById(project.eventId);
    if (event && event.submissionDeadline && new Date().getTime() > new Date(event.submissionDeadline).getTime()) {
      return res.status(400).json({
        error: 'DeadlineExceeded',
        message: 'The submission deadline for this event has passed. Project edits are no longer allowed.'
      });
    }

    const { title, description, repositoryUrl, trackId } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 2) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Project title must be at least 2 characters long.'
        });
      }
      project.title = title.trim();
    }

    if (description !== undefined) {
      project.description = String(description).trim();
    }

    if (repositoryUrl !== undefined) {
      project.repositoryUrl = String(repositoryUrl).trim();
    }

    if (trackId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(trackId)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid track ID format.'
        });
      }

      const track = await Track.findById(trackId);
      if (!track) {
        return res.status(404).json({
          error: 'NotFound',
          message: 'Track not found.'
        });
      }

      if (track.eventId.toString() !== project.eventId.toString()) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'The specified track does not belong to this event.'
        });
      }

      project.trackId = trackId;
    }

    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('eventId', 'name status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description');

    return res.status(200).json({
      message: 'Project updated successfully',
      project: populatedProject.toJSON()
    });
  } catch (error) {
    console.error('[Project Controller] Update error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update project.'
    });
  }
}

/**
 * Submit project explicitly (DRAFT -> SUBMITTED)
 * POST /api/projects/:id/submit
 */
export async function submitProject(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid project ID format.'
      });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Project not found.'
      });
    }

    // Verify authenticated user is member of project's team
    const team = await Team.findById(project.teamId);
    if (!team) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Associated team not found.'
      });
    }

    const isMember = team.members.some((m) => m.userId.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only members of this team can submit this project.'
      });
    }

    // Enforce submission deadline on project submission
    const event = await Event.findById(project.eventId);
    if (event && event.submissionDeadline && new Date().getTime() > new Date(event.submissionDeadline).getTime()) {
      return res.status(400).json({
        error: 'DeadlineExceeded',
        message: 'The submission deadline for this event has passed. Submissions are no longer accepted.'
      });
    }

    // Change status from draft to submitted
    project.status = 'submitted';
    await project.save();

    const populatedProject = await Project.findById(project._id)
      .populate('eventId', 'name status')
      .populate('teamId', 'name members')
      .populate('trackId', 'name description');

    return res.status(200).json({
      message: 'Project submitted successfully',
      project: populatedProject.toJSON()
    });
  } catch (error) {
    console.error('[Project Controller] Submit error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to submit project.'
    });
  }
}

/**
 * Public Project Gallery with Search & Filter
 * GET /api/projects or GET /api/events/:eventId/projects
 * Query parameters:
 *  - q: search string matched against title and description (case-insensitive)
 *  - eventId: filter by specific event ID
 *  - trackId: filter by specific track ID
 */
export async function getProjects(req, res) {
  try {
    const eventId = req.params.eventId || req.query.eventId;
    const { q, trackId } = req.query;

    // Only submitted projects are visible in the public gallery
    const filter = {
      status: 'submitted'
    };

    if (eventId) {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid event ID format.'
        });
      }
      filter.eventId = eventId;
    }

    if (trackId) {
      if (!mongoose.Types.ObjectId.isValid(trackId)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid track ID format.'
        });
      }
      filter.trackId = trackId;
    }

    if (q && typeof q === 'string' && q.trim().length > 0) {
      const sanitizedQ = q.trim();
      filter.$or = [
        { title: { $regex: sanitizedQ, $options: 'i' } },
        { description: { $regex: sanitizedQ, $options: 'i' } }
      ];
    }

    const projects = await Project.find(filter)
      .populate('eventId', 'name startDate submissionDeadline endDate status')
      .populate({
        path: 'teamId',
        select: 'name members',
        populate: {
          path: 'members.userId',
          select: 'email role'
        }
      })
      .populate('trackId', 'name description')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      projects,
      count: projects.length
    });
  } catch (error) {
    console.error('[Project Controller] GetProjects error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve projects gallery.'
    });
  }
}

export default {
  createProject,
  getProjects,
  getProjectById,
  getProjectByTeam,
  getMyProjects,
  updateProject,
  submitProject
};
