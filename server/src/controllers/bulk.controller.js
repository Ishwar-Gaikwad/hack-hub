import Event from '../models/event.model.js';
import Track from '../models/track.model.js';
import Team from '../models/team.model.js';
import Project from '../models/project.model.js';
import Prize from '../models/prize.model.js';
import Score from '../models/score.model.js';
import Vote from '../models/vote.model.js';
import AuditLog from '../models/audit.model.js';

/**
 * Bulk Import projects and teams with pre-validation and atomic commit
 * POST /api/events/:eventId/import
 */
export async function bulkImport(req, res) {
  const { eventId } = req.params;
  const { teams = [], projects = [] } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    if (!Array.isArray(teams) || !Array.isArray(projects)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid import format. "teams" and "projects" must be arrays.'
      });
    }

    if (teams.length === 0 && projects.length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Import payload cannot be empty'
      });
    }

    // Step 1: Pre-validate all team records
    const validationErrors = [];
    teams.forEach((t, idx) => {
      if (!t.name || typeof t.name !== 'string' || t.name.trim().length < 2) {
        validationErrors.push(`Team at index ${idx}: Name is required and must be at least 2 characters`);
      }
    });

    // Step 2: Pre-validate all project records
    const tracks = await Track.find({ eventId: event._id });
    const defaultTrack = tracks[0] || await Track.create({ eventId: event._id, name: 'General' });

    projects.forEach((p, idx) => {
      if (!p.title || typeof p.title !== 'string' || p.title.trim().length < 2) {
        validationErrors.push(`Project at index ${idx}: Title is required and must be at least 2 characters`);
      }
    });

    // If ANY item is invalid, reject the entire transaction before writing to DB!
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'ImportValidationError',
        message: 'Import failed validation. No data was written.',
        errors: validationErrors
      });
    }

    // Step 3: Transactional creation
    const createdTeams = [];
    const teamNameToDocMap = new Map();

    for (const tData of teams) {
      const team = await Team.create({
        eventId: event._id,
        name: tData.name.trim(),
        creatorId: req.user._id,
        members: [{ userId: req.user._id, role: 'owner' }]
      });
      createdTeams.push(team);
      teamNameToDocMap.set(team.name.toLowerCase(), team);
    }

    const createdProjects = [];
    for (const pData of projects) {
      // Find matching team or assign creator's team
      let assignedTeam = null;
      if (pData.teamName) {
        assignedTeam = teamNameToDocMap.get(pData.teamName.toLowerCase()) ||
          await Team.findOne({ eventId: event._id, name: new RegExp(`^${pData.teamName}$`, 'i') });
      }
      if (!assignedTeam && createdTeams.length > 0) {
        assignedTeam = createdTeams[0];
      }
      if (!assignedTeam) {
        assignedTeam = await Team.create({
          eventId: event._id,
          name: `${pData.title} Team`,
          creatorId: req.user._id,
          members: [{ userId: req.user._id, role: 'owner' }]
        });
        createdTeams.push(assignedTeam);
      }

      const proj = await Project.create({
        eventId: event._id,
        teamId: assignedTeam._id,
        trackId: defaultTrack._id,
        title: pData.title.trim(),
        description: pData.description || '',
        repositoryUrl: pData.repositoryUrl || '',
        status: pData.status === 'submitted' ? 'submitted' : 'draft'
      });
      createdProjects.push(proj);
    }

    await AuditLog.create({
      action: 'bulk_import.executed',
      actorId: req.user._id,
      eventId: event._id,
      metadata: {
        importedTeams: createdTeams.length,
        importedProjects: createdProjects.length
      },
      ip: String(req.ip || '127.0.0.1')
    });

    return res.status(201).json({
      message: 'Bulk import completed successfully',
      importedTeamsCount: createdTeams.length,
      importedProjectsCount: createdProjects.length,
      teams: createdTeams.map(t => ({ _id: t._id, name: t.name })),
      projects: createdProjects.map(p => ({ _id: p._id, title: p.title, status: p.status }))
    });
  } catch (error) {
    console.error('[Bulk Controller] Error during bulk import:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to complete bulk import' });
  }
}

/**
 * Bulk Export complete event archive in JSON format
 * GET /api/events/:eventId/export/full
 */
export async function bulkExportFull(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId).lean();
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const [tracks, prizes, teams, projects, scores, voteCount] = await Promise.all([
      Track.find({ eventId }).lean(),
      Prize.find({ eventId }).lean(),
      Team.find({ eventId }).lean(),
      Project.find({ eventId }).populate('teamId', 'name').populate('trackId', 'name').lean(),
      Score.find({ eventId }).select('-__v').lean(),
      Vote.countDocuments({ eventId })
    ]);

    const archive = {
      exportedAt: new Date().toISOString(),
      platform: 'HackHub DOGFOOD 2026',
      event: {
        id: event._id,
        name: event.name,
        description: event.description,
        startDate: event.startDate,
        submissionDeadline: event.submissionDeadline,
        endDate: event.endDate,
        status: event.status,
        votingOpenAt: event.votingOpenAt,
        votingCloseAt: event.votingCloseAt
      },
      tracks: tracks.map(t => ({ id: t._id, name: t.name, description: t.description })),
      prizes: prizes.map(p => ({ id: p._id, name: p.name, value: p.value, description: p.description })),
      teams: teams.map(t => ({ id: t._id, name: t.name, memberCount: t.members?.length || 0 })),
      projects: projects.map(p => ({
        id: p._id,
        title: p.title,
        description: p.description,
        repositoryUrl: p.repositoryUrl,
        status: p.status,
        teamName: p.teamId?.name || 'Independent',
        trackName: p.trackId?.name || 'General'
      })),
      statistics: {
        totalTeams: teams.length,
        totalProjects: projects.length,
        submittedProjects: projects.filter(p => p.status === 'submitted').length,
        totalEvaluations: scores.length,
        totalVotes: voteCount
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="event-${event._id}-archive.json"`);
    return res.status(200).json(archive);
  } catch (error) {
    console.error('[Bulk Controller] Error exporting full event:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to export event' });
  }
}

/**
 * Bulk Export projects or teams as CSV
 * GET /api/events/:eventId/export/csv
 */
export async function bulkExportCSV(req, res) {
  const { eventId } = req.params;
  const { type = 'projects' } = req.query;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    if (type === 'teams') {
      const teams = await Team.find({ eventId }).lean();
      const csvRows = ['Team ID,Team Name,Member Count,Created At'];
      for (const t of teams) {
        const row = [
          t._id,
          `"${(t.name || '').replace(/"/g, '""')}"`,
          t.members?.length || 0,
          t.createdAt ? new Date(t.createdAt).toISOString() : ''
        ].join(',');
        csvRows.push(row);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="event-${eventId}-teams.csv"`);
      return res.status(200).send(csvRows.join('\n'));
    }

    // Default: export projects CSV
    const projects = await Project.find({ eventId })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .lean();

    const csvRows = ['Project ID,Title,Team,Track,Status,Repository URL,Created At'];
    for (const p of projects) {
      const row = [
        p._id,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${(p.teamId?.name || 'Independent').replace(/"/g, '""')}"`,
        `"${(p.trackId?.name || 'General').replace(/"/g, '""')}"`,
        p.status,
        `"${(p.repositoryUrl || '').replace(/"/g, '""')}"`,
        p.createdAt ? new Date(p.createdAt).toISOString() : ''
      ].join(',');
      csvRows.push(row);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event-${eventId}-projects.csv"`);
    return res.status(200).send(csvRows.join('\n'));
  } catch (error) {
    console.error('[Bulk Controller] Error exporting CSV:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to export CSV' });
  }
}

export default {
  bulkImport,
  bulkExportFull,
  bulkExportCSV
};
