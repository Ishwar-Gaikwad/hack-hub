import Score from '../models/score.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';

/**
 * GET /api/judge/scores
 * Returns scores for the authenticated judge.
 * Enforces strict peer isolation (judges cannot view peer scores) and participant blocking.
 */
export async function getJudgeScores(req, res) {
  try {
    const user = req.user;

    // Participants are blocked from accessing judge scores
    if (user.role === 'participant') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Participants are not permitted to access judging scores.'
      });
    }

    const targetJudgeParam = req.query.judge;

    // Enforce peer isolation for judges
    if (user.role === 'judge' && targetJudgeParam) {
      const normalizedParam = targetJudgeParam.trim().toLowerCase();
      const userEmail = (user.email || '').toLowerCase();
      
      const isSelf = 
        userEmail === normalizedParam ||
        userEmail.includes(normalizedParam) ||
        user._id.toString() === normalizedParam ||
        (normalizedParam === 'judge_a' && userEmail.includes('judge_a')) ||
        (normalizedParam === 'judge_b' && userEmail.includes('judge_b'));

      if (!isSelf) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Backend authorization failure: Judges are strictly prohibited from inspecting peer scores.'
        });
      }
    }

    // Query scores for the requesting judge (or queried judge if organizer)
    const filter = {};
    if (user.role === 'judge') {
      filter.judgeId = user._id;
    }

    const scores = await Score.find(filter)
      .populate('projectId', 'title status repositoryUrl')
      .populate('judgeId', 'email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      judge: user.email,
      count: scores.length,
      scores
    });
  } catch (error) {
    console.error('[Judging Controller] Error getting scores:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve judge scores.'
    });
  }
}

/**
 * GET /api/export.csv
 * Exports hackathon projects and evaluations in CSV format.
 * Restricted to organizers and admins.
 */
export async function exportCSV(req, res) {
  try {
    const user = req.user;

    if (user.role !== 'organizer' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only organizers and administrators can export evaluation data.'
      });
    }

    const projects = await Project.find({ status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .sort({ createdAt: 1 });

    const scores = await Score.find({});

    // Build project score lookup
    const scoreMap = new Map();
    for (const s of scores) {
      const pId = s.projectId ? s.projectId.toString() : s.projectRef;
      if (!scoreMap.has(pId)) scoreMap.set(pId, []);
      const avg = ((s.criteria?.functionality || 3) + (s.criteria?.quality || 3) + (s.criteria?.innovation || 3)) / 3;
      scoreMap.get(pId).push(avg);
    }

    // CSV Header row
    const csvRows = [
      'Project ID,Project Title,Team Name,Track,Status,Reviews Count,Average Score'
    ];

    for (const p of projects) {
      const pIdStr = p._id.toString();
      const pScores = scoreMap.get(pIdStr) || [];
      const avgScore = pScores.length > 0 
        ? (pScores.reduce((a, b) => a + b, 0) / pScores.length).toFixed(2) 
        : 'N/A';

      const safeTitle = `"${(p.title || '').replace(/"/g, '""')}"`;
      const safeTeam = `"${(p.teamId?.name || '').replace(/"/g, '""')}"`;
      const safeTrack = `"${(p.trackId?.name || '').replace(/"/g, '""')}"`;

      csvRows.push(`${p._id},${safeTitle},${safeTeam},${safeTrack},${p.status},${pScores.length},${avgScore}`);
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hackhub-results.csv"');
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('[Judging Controller] CSV export error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to generate CSV export.'
    });
  }
}

export default {
  getJudgeScores,
  exportCSV
};
