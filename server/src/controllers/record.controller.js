import crypto from 'crypto';
import Event from '../models/event.model.js';
import Project from '../models/project.model.js';
import Score from '../models/score.model.js';

const SYSTEM_SECRET = process.env.SYSTEM_SIGNING_KEY || 'hackhub-dogfood-verifiable-record-signing-key-2026';

/**
 * Anonymize a judge ID to a 12-char pseudonym so judge identities remain private while verifiable
 */
function anonymizeJudgeId(judgeId) {
  return 'JDG-' + crypto.createHash('sha256').update(judgeId.toString() + SYSTEM_SECRET).digest('hex').substring(0, 8).toUpperCase();
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

/**
 * Sign canonical manifest with HMAC-SHA256
 */
export function signManifest(manifest) {
  const canonicalString = JSON.stringify(canonicalize(manifest));
  return crypto.createHmac('sha256', SYSTEM_SECRET).update(canonicalString, 'utf8').digest('hex');
}

/**
 * Generate a verifiable judging record for an event
 * GET /api/events/:eventId/records/judging
 */
export async function getJudgingRecord(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const projects = await Project.find({ eventId, status: 'submitted' }).lean();
    const scores = await Score.find({ eventId }).lean();

    // Group scores by project
    const projectScoresMap = {};
    for (const sc of scores) {
      const pId = sc.projectId.toString();
      if (!projectScoresMap[pId]) projectScoresMap[pId] = [];
      projectScoresMap[pId].push({
        judgePseudonym: anonymizeJudgeId(sc.judgeId),
        normalizedScore: sc.normalizedScore || sc.rawTotal || 0,
        criteria: sc.criteria || {}
      });
    }

    const compiledResults = projects.map(p => {
      const pScores = projectScoresMap[p._id.toString()] || [];
      const totalScore = pScores.reduce((sum, s) => sum + s.normalizedScore, 0);
      const avgScore = pScores.length > 0 ? parseFloat((totalScore / pScores.length).toFixed(2)) : 0;

      return {
        projectId: p._id.toString(),
        title: p.title,
        evaluationCount: pScores.length,
        averageScore: avgScore,
        evaluations: pScores
      };
    }).sort((a, b) => b.averageScore - a.averageScore)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    const manifest = {
      recordType: 'OFFICIAL_JUDGING_RECORD',
      platform: 'HackHub DOGFOOD 2026',
      eventId: event._id.toString(),
      eventName: event.name,
      totalEvaluations: scores.length,
      evaluatedProjectsCount: compiledResults.filter(p => p.evaluationCount > 0).length,
      results: compiledResults,
      publishedAt: new Date().toISOString()
    };

    const signature = signManifest(manifest);

    return res.status(200).json({
      verifiableRecord: manifest,
      signature: `sha256=${signature}`,
      verificationAlgorithm: 'HMAC-SHA256',
      instructions: 'Submit record to /api/events/:eventId/records/verify to verify cryptographic authenticity'
    });
  } catch (error) {
    console.error('[Record Controller] Error creating judging record:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to generate judging record' });
  }
}

/**
 * Verify a previously published judging record manifest
 * POST /api/events/:eventId/records/verify
 */
export async function verifyRecord(req, res) {
  const { eventId } = req.params;
  const { manifest, signature } = req.body;

  try {
    if (!manifest || !signature) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Both manifest object and signature are required for verification'
      });
    }

    if (manifest.eventId !== eventId) {
      return res.status(400).json({
        verified: false,
        error: 'EventMismatch',
        message: 'Manifest eventId does not match URL event parameter'
      });
    }

    const expectedSig = signManifest(manifest);
    const cleanSig = signature.replace(/^sha256=/, '').trim();

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'hex'),
      Buffer.from(cleanSig, 'hex')
    );

    if (isMatch) {
      return res.status(200).json({
        verified: true,
        message: 'Record signature verified successfully. The judging data has not been modified.',
        eventId: manifest.eventId,
        verifiedAt: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        verified: false,
        message: 'Record signature verification failed. The record may have been altered or tampered with.'
      });
    }
  } catch (error) {
    return res.status(400).json({
      verified: false,
      error: 'InvalidVerificationFormat',
      message: 'Failed to verify record signature: ' + error.message
    });
  }
}

export default {
  getJudgingRecord,
  verifyRecord,
  signManifest
};
