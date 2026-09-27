import crypto from 'crypto';
import Event from '../models/event.model.js';
import Project from '../models/project.model.js';
import Team from '../models/team.model.js';
import User from '../models/user.model.js';
import Score from '../models/score.model.js';
import Vote from '../models/vote.model.js';

/**
 * Generate cryptographic verification hash for a certificate record
 */
function generateCertificateHash(event, recipient, achievement, issueDate) {
  const content = `${event._id}:${recipient._id}:${achievement.type}:${achievement.title || ''}:${issueDate.toISOString()}`;
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * List all available certificates for an event
 * GET /api/events/:eventId/certificates
 */
export async function getEventCertificates(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    // Find submitted projects
    const projects = await Project.find({ eventId, status: 'submitted' })
      .populate('teamId')
      .populate('trackId');

    // Aggregate winner / ranking data based on votes
    const voteAggregates = await Vote.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const certificates = [];

    // Participation & Winner certificates for team members
    for (const proj of projects) {
      const team = proj.teamId;
      if (!team || !team.members) continue;

      const isTopChoice = voteAggregates.length > 0 && voteAggregates[0]._id.toString() === proj._id.toString();

      for (const member of team.members) {
        const user = await User.findById(member.userId).select('email role');
        if (!user) continue;

        // Participation certificate
        certificates.push({
          type: 'participation',
          recipientId: user._id,
          recipientEmail: user.email,
          projectTitle: proj.title,
          teamName: team.name,
          award: 'Official Participant'
        });

        // Winner certificate if applicable
        if (isTopChoice) {
          certificates.push({
            type: 'winner',
            recipientId: user._id,
            recipientEmail: user.email,
            projectTitle: proj.title,
            teamName: team.name,
            award: 'Community Choice Award Winner'
          });
        }
      }
    }

    // Judge certificates
    const judgesWhoScored = await Score.distinct('judgeId', { eventId: event._id });
    for (const jId of judgesWhoScored) {
      const judgeUser = await User.findById(jId).select('email role');
      if (judgeUser) {
        certificates.push({
          type: 'judge',
          recipientId: judgeUser._id,
          recipientEmail: judgeUser.email,
          award: 'Official Hackathon Judge'
        });
      }
    }

    return res.status(200).json({
      eventId: event._id,
      eventName: event.name,
      count: certificates.length,
      certificates
    });
  } catch (error) {
    console.error('[Certificate Controller] Error fetching certificates:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to load certificates' });
  }
}

/**
 * Generate a specific certificate record
 * GET /api/events/:eventId/certificates/:type/:recipientId
 */
export async function getCertificate(req, res) {
  const { eventId, type, recipientId } = req.params;
  const { format } = req.query;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const recipient = await User.findById(recipientId).select('email role');
    if (!recipient) {
      return res.status(404).json({ error: 'RecipientNotFound', message: 'Recipient user not found' });
    }

    let achievement = null;
    const issueDate = new Date();

    if (type === 'participation' || type === 'winner') {
      // Verify user actually belonged to a team with a submitted project
      const teams = await Team.find({ eventId: event._id, 'members.userId': recipient._id });
      const teamIds = teams.map(t => t._id);
      const project = await Project.findOne({ eventId: event._id, teamId: { $in: teamIds }, status: 'submitted' });

      if (!project) {
        return res.status(400).json({
          error: 'CertificateIneligible',
          message: 'Recipient does not have a submitted project in this event'
        });
      }

      if (type === 'winner') {
        const topVote = await Vote.aggregate([
          { $match: { eventId: event._id } },
          { $group: { _id: '$projectId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 }
        ]);

        if (!topVote.length || topVote[0]._id.toString() !== project._id.toString()) {
          return res.status(400).json({
            error: 'CertificateIneligible',
            message: 'Recipient project did not win an official award in this event'
          });
        }
      }

      achievement = {
        type,
        title: type === 'winner' ? 'Community Choice Award Winner' : 'Certificate of Hackathon Participation',
        projectTitle: project.title,
        track: project.trackId ? (await Project.findById(project._id).populate('trackId')).trackId?.name : 'General'
      };
    } else if (type === 'judge') {
      const scoreCount = await Score.countDocuments({ eventId: event._id, judgeId: recipient._id });
      if (scoreCount === 0) {
        return res.status(400).json({
          error: 'CertificateIneligible',
          message: 'Recipient has not completed judging evaluations for this event'
        });
      }
      achievement = {
        type: 'judge',
        title: 'Certificate of Judging Excellence',
        evaluationsCompleted: scoreCount
      };
    } else {
      return res.status(400).json({
        error: 'InvalidCertificateType',
        message: 'Supported types: participation, winner, judge'
      });
    }

    const verificationHash = generateCertificateHash(event, recipient, achievement, issueDate);

    const certificateRecord = {
      certificateId: `CERT-${event._id.toString().substring(0, 6).toUpperCase()}-${recipient._id.toString().substring(0, 6).toUpperCase()}`,
      eventId: event._id,
      eventName: event.name,
      recipient: {
        _id: recipient._id,
        email: recipient.email,
        role: recipient.role
      },
      achievement,
      issuedAt: issueDate.toISOString(),
      verification: {
        hash: verificationHash,
        algorithm: 'sha256',
        verifiableUrl: `/api/events/${event._id}/records/verify?hash=${verificationHash}`
      }
    };

    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${achievement.title} - ${recipient.email}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; display: flex; justify-content: center; }
    .cert-card { background: #1e293b; border: 2px solid #6366f1; border-radius: 12px; padding: 3rem; max-width: 700px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { color: #818cf8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; font-size: 1.75rem; }
    h2 { color: #cbd5e1; font-size: 1.25rem; font-weight: normal; margin-top: 0; }
    .recipient { font-size: 1.75rem; font-weight: bold; color: #facc15; margin: 1.5rem 0; }
    .desc { color: #94a3b8; font-size: 1rem; line-height: 1.6; margin-bottom: 2rem; }
    .hash { font-family: monospace; font-size: 0.75rem; color: #64748b; word-break: break-all; margin-top: 2rem; border-top: 1px solid #334155; padding-top: 1rem; }
  </style>
</head>
<body>
  <div class="cert-card">
    <h1>${achievement.title}</h1>
    <h2>Presented at ${event.name}</h2>
    <div class="desc">This certifies that</div>
    <div class="recipient">${recipient.email}</div>
    <div class="desc">
      ${achievement.projectTitle ? `Successfully built and submitted <strong>${achievement.projectTitle}</strong>.` : 'Served as an official peer reviewer and judge.'}
    </div>
    <div class="hash">
      Certificate ID: ${certificateRecord.certificateId} | SHA-256: ${verificationHash}
    </div>
  </div>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    return res.status(200).json(certificateRecord);
  } catch (error) {
    console.error('[Certificate Controller] Error generating certificate:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to generate certificate' });
  }
}

export default {
  getEventCertificates,
  getCertificate
};
