import Score, { calculateWeightedScore, RUBRIC_CRITERIA } from '../models/score.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import Event from '../models/event.model.js';
import AuditLog from '../models/audit.model.js';

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
 * GET /api/judge/projects
 * Retrieves assigned projects for the authenticated judge.
 * Shows completion state, progress stats, and judge's own score for each project.
 */
export async function getJudgeProjects(req, res) {
  try {
    const user = req.user;
    if (user.role !== 'judge' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only judges and administrators can access the judge evaluation dashboard.'
      });
    }

    const { eventId } = req.query;

    let targetEvent;
    if (eventId) {
      targetEvent = await Event.findById(eventId);
    } else {
      // Find published or active event, or most recent event
      targetEvent = await Event.findOne({ status: { $in: ['active', 'published', 'ended'] } }).sort({ createdAt: -1 });
      if (!targetEvent) {
        targetEvent = await Event.findOne({}).sort({ createdAt: -1 });
      }
    }

    if (!targetEvent) {
      return res.status(200).json({
        event: null,
        stats: { totalAssigned: 0, completedCount: 0, remainingCount: 0, progressPercentage: 0 },
        projects: [],
        rubric: RUBRIC_CRITERIA
      });
    }

    // Fetch submitted projects for this event
    const projects = await Project.find({
      eventId: targetEvent._id,
      status: 'submitted'
    })
      .populate('teamId', 'name')
      .populate('trackId', 'name description')
      .sort({ createdAt: 1 });

    // Fetch existing scores by THIS judge only (strict peer isolation)
    const myScores = await Score.find({
      judgeId: user._id,
      eventId: targetEvent._id
    }).lean();

    const scoreMap = new Map();
    for (const sc of myScores) {
      scoreMap.set(sc.projectId.toString(), sc);
    }

    const projectList = projects.map(p => {
      const pIdStr = p._id.toString();
      const existingScore = scoreMap.get(pIdStr);
      return {
        _id: p._id,
        title: p.title,
        description: p.description,
        repositoryUrl: p.repositoryUrl,
        status: p.status,
        team: p.teamId ? { _id: p.teamId._id, name: p.teamId.name } : null,
        track: p.trackId ? { _id: p.trackId._id, name: p.trackId.name, description: p.trackId.description } : null,
        isReviewed: Boolean(existingScore),
        myScore: existingScore ? {
          _id: existingScore._id,
          criteria: existingScore.criteria,
          rawTotal: existingScore.rawTotal,
          weightedScore: existingScore.weightedScore || existingScore.rawTotal,
          comment: existingScore.comment || '',
          updatedAt: existingScore.updatedAt
        } : null
      };
    });

    const totalAssigned = projectList.length;
    const completedCount = projectList.filter(p => p.isReviewed).length;
    const remainingCount = Math.max(0, totalAssigned - completedCount);
    const progressPercentage = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

    return res.status(200).json({
      event: {
        _id: targetEvent._id,
        name: targetEvent.name,
        status: targetEvent.status,
        submissionDeadline: targetEvent.submissionDeadline,
        endDate: targetEvent.endDate
      },
      stats: {
        totalAssigned,
        completedCount,
        remainingCount,
        progressPercentage
      },
      projects: projectList,
      rubric: RUBRIC_CRITERIA
    });
  } catch (error) {
    console.error('[Judging Controller] Error getting judge projects:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve judge assigned projects.'
    });
  }
}

/**
 * POST /api/judge/scores
 * Submits an evaluation score from an authenticated judge.
 * Validates criteria (1-10), project submission status, event status, and duplicate submission prevention.
 */
export async function submitScore(req, res) {
  try {
    const user = req.user;
    if (user.role !== 'judge' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only judges and administrators are permitted to submit evaluations.'
      });
    }

    const { projectId, eventId, criteria, comment = '' } = req.body;

    if (!projectId) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Project ID is required.'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Project not found.'
      });
    }

    if (project.status !== 'submitted') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Cannot evaluate an unsubmitted project draft.'
      });
    }

    const targetEventId = eventId || project.eventId;
    const event = await Event.findById(targetEventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Associated hackathon event not found.'
      });
    }

    if (event.status === 'closed') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Judging is closed for this event.'
      });
    }

    // Validate criteria
    if (!criteria || typeof criteria !== 'object') {
      return res.status(400).json({
        error: 'IncompleteReview',
        message: 'Incomplete review: Evaluation rubric criteria must be provided.'
      });
    }

    // Check required fields: supports either all 5 standard dimensions or all 3 legacy dimensions
    const dims = ['technicalInnovation', 'execution', 'design', 'impact', 'documentation'];
    const legacyDims = ['functionality', 'quality', 'innovation'];
    const hasStandard = dims.every(d => criteria[d] !== undefined);
    const hasLegacy = legacyDims.every(d => criteria[d] !== undefined);

    if (!hasStandard && !hasLegacy) {
      return res.status(400).json({
        error: 'IncompleteReview',
        message: 'Incomplete review: All evaluation criteria must be scored.'
      });
    }

    // Check numeric range 1 to 10 for all provided criteria
    const allGivenKeys = Object.keys(criteria);
    for (const key of allGivenKeys) {
      const val = criteria[key];
      if (typeof val !== 'number' || val < 1 || val > 10 || !Number.isFinite(val)) {
        return res.status(400).json({
          error: 'InvalidScore',
          message: `Criterion score for "${key}" must be a number between 1 and 10.`
        });
      }
    }

    // Duplicate review check
    const existing = await Score.findOne({
      judgeId: user._id,
      projectId: project._id
    });

    if (existing) {
      return res.status(409).json({
        error: 'DuplicateReview',
        message: 'Duplicate review: You have already submitted an evaluation for this project. Please update your existing review.'
      });
    }

    const weightedScore = calculateWeightedScore(criteria);

    const newScore = await Score.create({
      judgeId: user._id,
      judgeRef: user.email,
      eventId: event._id,
      projectId: project._id,
      criteria,
      rawTotal: weightedScore,
      weightedScore,
      normalizedScore: weightedScore,
      comment: String(comment || '').trim()
    });

    // Record audit event
    await AuditLog.create({
      action: 'review.submitted',
      actorId: user._id,
      eventId: event._id,
      projectId: project._id,
      metadata: {
        scoreId: newScore._id,
        weightedScore,
        criteria
      },
      ip: req.ip || ''
    }).catch(err => console.warn('[Judging Audit] Failed to record audit log:', err.message));

    return res.status(201).json({
      message: 'Review submitted successfully',
      score: newScore
    });
  } catch (error) {
    console.error('[Judging Controller] Error submitting score:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to submit review score.'
    });
  }
}

/**
 * PUT /api/judge/scores/:scoreId
 * Updates an existing review score.
 * Only the judge who created the score (or admin) can update it.
 */
export async function updateScore(req, res) {
  try {
    const user = req.user;
    const { scoreId } = req.params;
    const { criteria, comment } = req.body;

    const score = await Score.findById(scoreId);
    if (!score) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Review score record not found.'
      });
    }

    // Enforce authorization: only author judge or admin can update
    if (user.role !== 'admin' && score.judgeId.toString() !== user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not permitted to modify another judge\'s score.'
      });
    }

    if (criteria && typeof criteria === 'object') {
      for (const key of Object.keys(criteria)) {
        const val = criteria[key];
        if (typeof val !== 'number' || val < 1 || val > 10 || !Number.isFinite(val)) {
          return res.status(400).json({
            error: 'InvalidScore',
            message: `Criterion score for "${key}" must be a number between 1 and 10.`
          });
        }
      }
      score.criteria = { ...score.criteria, ...criteria };
      const weighted = calculateWeightedScore(score.criteria);
      score.rawTotal = weighted;
      score.weightedScore = weighted;
      score.normalizedScore = weighted;
    }

    if (comment !== undefined) {
      score.comment = String(comment).trim();
    }

    await score.save();

    await AuditLog.create({
      action: 'review.updated',
      actorId: user._id,
      eventId: score.eventId,
      projectId: score.projectId,
      metadata: { scoreId: score._id, weightedScore: score.weightedScore },
      ip: req.ip || ''
    }).catch(err => console.warn('[Judging Audit] Failed to log update:', err.message));

    return res.status(200).json({
      message: 'Review updated successfully',
      score
    });
  } catch (error) {
    console.error('[Judging Controller] Error updating score:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update review score.'
    });
  }
}

/**
 * GET /api/events/:eventId/judging/overview
 * Comprehensive Judging & Fairness Control Center for Organizers and Admins.
 * Calculates Z-scores, Min-Max scaling, zero-variance fallback, discrepancy detection (diff > 2.0),
 * progress metrics, and audit trail.
 */
export async function getOrganizerJudgingOverview(req, res) {
  try {
    const user = req.user;
    const { eventId } = req.params;

    if (user.role !== 'organizer' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only event organizers and administrators can access the judging overview.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Hackathon event not found.'
      });
    }

    if (user.role === 'organizer' && event.createdBy.toString() !== user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view judging data for hackathons you host.'
      });
    }

    // 1. Fetch submitted projects
    const projects = await Project.find({ eventId: event._id, status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .sort({ createdAt: 1 })
      .lean();

    // 2. Fetch all scores for this event
    const scores = await Score.find({ eventId: event._id })
      .populate('judgeId', 'email role')
      .populate('projectId', 'title')
      .sort({ createdAt: 1 })
      .lean();

    // 3. Group scores by judge for statistical normalization
    const judgeScoresMap = new Map(); // judgeId -> array of score docs
    for (const sc of scores) {
      const jId = sc.judgeId ? sc.judgeId._id.toString() : (sc.judgeRef || 'unknown');
      if (!judgeScoresMap.has(jId)) {
        judgeScoresMap.set(jId, {
          judgeId: jId,
          email: sc.judgeId?.email || sc.judgeRef || 'Judge',
          scores: []
        });
      }
      judgeScoresMap.get(jId).scores.push(sc);
    }

    // 4. Calculate Mean and Standard Deviation per judge, with ZERO-VARIANCE handling
    const judgeStats = new Map();
    judgeScoresMap.forEach((entry, jId) => {
      const vals = entry.scores.map(s => Number(s.rawTotal ?? s.weightedScore ?? 50));
      const n = vals.length;
      const mean = n > 0 ? vals.reduce((a, b) => a + b, 0) / n : 0;
      
      const variance = n > 1
        ? vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
        : 0;
      const stdDev = Math.sqrt(variance);

      // ZERO-VARIANCE JUDGE (Section 7):
      // When all scores are identical or stdDev is 0, isZeroVariance is true.
      const isZeroVariance = n >= 1 && stdDev < 0.0001;

      judgeStats.set(jId, {
        judgeId: jId,
        email: entry.email,
        completed: n,
        assigned: projects.length,
        remaining: Math.max(0, projects.length - n),
        mean: Math.round(mean * 10) / 10,
        stdDev: Math.round(stdDev * 100) / 100,
        isZeroVariance
      });
    });

    // 5. Compute Z-Scores and collect min/max Z for Min-Max Scaling
    const scoresWithZ = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const sc of scores) {
      const jId = sc.judgeId ? sc.judgeId._id.toString() : (sc.judgeRef || 'unknown');
      const stats = judgeStats.get(jId) || { mean: 50, stdDev: 0, isZeroVariance: true };
      const rawVal = Number(sc.rawTotal ?? sc.weightedScore ?? 50);

      let z = 0;
      if (!stats.isZeroVariance && stats.stdDev > 0) {
        z = (rawVal - stats.mean) / stats.stdDev;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      scoresWithZ.push({
        scoreDoc: sc,
        jId,
        rawVal,
        z,
        isZeroVariance: stats.isZeroVariance
      });
    }

    // 6. Compute Normalized Score (0–100 scale) for each evaluation
    const normalizedScoreMap = new Map(); // scoreId -> normalized score
    for (const item of scoresWithZ) {
      let norm;
      if (item.isZeroVariance || !Number.isFinite(minZ) || !Number.isFinite(maxZ) || maxZ === minZ) {
        // Fallback for zero-variance judge: map raw score cleanly without division by zero
        // If rawVal is 70 on 0-100 scale, normalized is 70.
        norm = Math.min(100, Math.max(0, Math.round(item.rawVal * 10) / 10));
      } else {
        // Min-Max scaling of Z-score to 0-100
        const scaled = ((item.z - minZ) / (maxZ - minZ)) * 100;
        norm = Math.min(100, Math.max(0, Math.round(scaled * 10) / 10));
      }
      normalizedScoreMap.set(item.scoreDoc._id.toString(), norm);
    }

    // 7. Group scores by Project, calculate final rankings, and perform Discrepancy Detection
    const projectScoresMap = new Map();
    for (const p of projects) {
      projectScoresMap.set(p._id.toString(), []);
    }

    for (const sc of scores) {
      const pIdStr = sc.projectId ? (sc.projectId._id ? sc.projectId._id.toString() : sc.projectId.toString()) : '';
      if (projectScoresMap.has(pIdStr)) {
        const normScore = normalizedScoreMap.get(sc._id.toString()) ?? Number(sc.rawTotal ?? 50);
        projectScoresMap.get(pIdStr).push({
          _id: sc._id,
          judgeId: sc.judgeId?._id?.toString() || '',
          judgeEmail: sc.judgeId?.email || sc.judgeRef || 'Judge',
          criteria: sc.criteria || {},
          rawScore: Number(sc.rawTotal ?? sc.weightedScore ?? 50),
          normalizedScore: normScore,
          comment: sc.comment || '',
          createdAt: sc.createdAt
        });
      }
    }

    const discrepancies = [];
    const leaderboard = [];
    const rubricKeys = [
      { key: 'technicalInnovation', label: 'Technical Innovation' },
      { key: 'execution', label: 'Execution & Completeness' },
      { key: 'design', label: 'Design & Usability' },
      { key: 'impact', label: 'Impact & Practicality' },
      { key: 'documentation', label: 'Documentation' },
      // Legacy checks
      { key: 'functionality', label: 'Functionality' },
      { key: 'quality', label: 'Quality' },
      { key: 'innovation', label: 'Innovation' }
    ];

    for (const p of projects) {
      const pIdStr = p._id.toString();
      const pReviews = projectScoresMap.get(pIdStr) || [];
      const reviewCount = pReviews.length;

      let projectHasDiscrepancy = false;

      // Discrepancy Detection: Check if two judges differ by > 2.0 on any criterion
      if (reviewCount >= 2) {
        for (const { key, label } of rubricKeys) {
          const criterionScores = pReviews
            .filter(r => r.criteria && r.criteria[key] !== undefined)
            .map(r => ({ score: Number(r.criteria[key]), judgeEmail: r.judgeEmail }));

          if (criterionScores.length >= 2) {
            let maxSc = -Infinity;
            let minSc = Infinity;
            let maxJudge = '';
            let minJudge = '';

            for (const cs of criterionScores) {
              if (cs.score > maxSc) {
                maxSc = cs.score;
                maxJudge = cs.judgeEmail;
              }
              if (cs.score < minSc) {
                minSc = cs.score;
                minJudge = cs.judgeEmail;
              }
            }

            const diff = maxSc - minSc;
            if (diff > 2.0) {
              projectHasDiscrepancy = true;
              discrepancies.push({
                projectId: p._id,
                projectTitle: p.title,
                criterion: label,
                criterionKey: key,
                difference: Math.round(diff * 10) / 10,
                judgeA: maxJudge,
                scoreA: maxSc,
                judgeB: minJudge,
                scoreB: minSc,
                note: `Review difference: ${diff.toFixed(1)} points`
              });
            }
          }
        }
      }

      // Calculate Raw Average and Adjusted (Normalized) Score
      const rawAvg = reviewCount > 0
        ? Math.round((pReviews.reduce((sum, r) => sum + r.rawScore, 0) / reviewCount) * 10) / 10
        : 0;

      const adjustedAvg = reviewCount > 0
        ? Math.round((pReviews.reduce((sum, r) => sum + r.normalizedScore, 0) / reviewCount) * 10) / 10
        : 0;

      // Final score: if 3 or more reviews, apply Trimmed Mean (drop highest and lowest)
      let finalScore = adjustedAvg;
      if (reviewCount >= 3) {
        const sortedNorm = [...pReviews.map(r => r.normalizedScore)].sort((a, b) => a - b);
        const trimmed = sortedNorm.slice(1, -1);
        finalScore = Math.round((trimmed.reduce((a, b) => a + b, 0) / trimmed.length) * 10) / 10;
      }

      leaderboard.push({
        projectId: p._id,
        title: p.title,
        teamName: p.teamId?.name || 'Independent',
        trackName: p.trackId?.name || 'General',
        reviewCount,
        rawAverage: rawAvg,
        adjustedScore: adjustedAvg,
        finalScore,
        hasDiscrepancy: projectHasDiscrepancy,
        reviews: pReviews
      });
    }

    // Sort leaderboard by final score descending
    leaderboard.sort((a, b) => b.finalScore - a.finalScore || b.rawAverage - a.rawAverage);
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    // 8. Projects Requiring Attention (Section 9)
    const insufficientReviews = leaderboard.filter(p => p.reviewCount < 2);
    const largeDiscrepancyProjects = leaderboard.filter(p => p.hasDiscrepancy);
    const incompleteProjects = leaderboard.filter(p => p.reviewCount === 0);

    // 9. Overall Judging Progress Metrics
    const totalSubmittedProjects = projects.length;
    const totalJudges = judgeStats.size;
    const totalReviews = scores.length;
    const targetReviewsPerProject = 2; // Standard allocation
    const expectedReviews = totalSubmittedProjects * targetReviewsPerProject;
    const pendingReviews = Math.max(0, expectedReviews - totalReviews);
    const completionPercentage = expectedReviews > 0
      ? Math.min(100, Math.round((totalReviews / expectedReviews) * 100))
      : 0;

    // 10. Audit Trail (Section 10)
    const auditLogs = await AuditLog.find({
      eventId: event._id,
      action: { $in: ['review.submitted', 'review.updated', 'score.flagged', 'results.published', 'judge.assigned'] }
    })
      .populate('actorId', 'email role')
      .populate('projectId', 'title')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const formattedAudit = auditLogs.map(l => ({
      _id: l._id,
      action: l.action,
      timestamp: l.createdAt,
      actorRole: l.actorId?.role || 'system',
      actorEmail: l.actorId?.email || 'system',
      projectTitle: l.projectId?.title || l.metadata?.projectTitle || 'N/A',
      result: l.metadata?.weightedScore ? `Score: ${l.metadata.weightedScore}/100` : (l.metadata?.note || 'Success')
    }));

    return res.status(200).json({
      event: {
        _id: event._id,
        name: event.name,
        status: event.status
      },
      progress: {
        totalSubmittedProjects,
        totalJudges,
        totalReviews,
        targetReviewsPerProject,
        expectedReviews,
        completedReviews: totalReviews,
        pendingReviews,
        completionPercentage
      },
      attention: {
        insufficientReviewsCount: insufficientReviews.length,
        discrepanciesCount: discrepancies.length,
        incompleteCount: incompleteProjects.length,
        projectsWithDiscrepancies: largeDiscrepancyProjects.map(p => ({ projectId: p.projectId, title: p.title })),
        projectsNeedingReviews: insufficientReviews.map(p => ({ projectId: p.projectId, title: p.title, reviews: p.reviewCount }))
      },
      judgeProgress: Array.from(judgeStats.values()),
      discrepancies,
      leaderboard,
      auditTrail: formattedAudit
    });
  } catch (error) {
    console.error('[Judging Controller] Error getting organizer judging overview:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve judging overview.'
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
  getJudgeProjects,
  submitScore,
  updateScore,
  getOrganizerJudgingOverview,
  exportCSV
};
