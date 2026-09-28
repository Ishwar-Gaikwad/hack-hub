import request from 'supertest';
import app from '../src/app.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Score from '../src/models/score.model.js';
import Vote from '../src/models/vote.model.js';
import Comment from '../src/models/comment.model.js';
import Webhook from '../src/models/webhook.model.js';

describe('Hostile Security Audit & Pen-Test Verification', () => {
  let organizerA, organizerB, judgeA, judgeB, participant1, participant2, admin;
  let tokenOrgA, tokenOrgB, tokenJudgeA, tokenJudgeB, tokenPart1, tokenPart2, tokenAdmin;
  let eventA, eventB, trackA, trackB, teamA, teamB, projectA, projectB;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Create users across all roles
    organizerA = await User.create({ email: 'org_a@hackhub.local', password: 'password123', role: 'organizer' });
    organizerB = await User.create({ email: 'org_b@hackhub.local', password: 'password123', role: 'organizer' });
    judgeA = await User.create({ email: 'judge_a@hackhub.local', password: 'password123', role: 'judge' });
    judgeB = await User.create({ email: 'judge_b@hackhub.local', password: 'password123', role: 'judge' });
    participant1 = await User.create({ email: 'part_1@hackhub.local', password: 'password123', role: 'participant' });
    participant2 = await User.create({ email: 'part_2@hackhub.local', password: 'password123', role: 'participant' });
    admin = await User.create({ email: 'admin@hackhub.local', password: 'password123', role: 'admin' });

    // Create sessions
    const expiresAt = new Date(Date.now() + 86400000);
    const sOrgA = await Session.create({ userId: organizerA._id, token: 'tok_orga', expiresAt });
    const sOrgB = await Session.create({ userId: organizerB._id, token: 'tok_orgb', expiresAt });
    const sJdgA = await Session.create({ userId: judgeA._id, token: 'tok_jdga', expiresAt });
    const sJdgB = await Session.create({ userId: judgeB._id, token: 'tok_jdgb', expiresAt });
    const sPrt1 = await Session.create({ userId: participant1._id, token: 'tok_prt1', expiresAt });
    const sPrt2 = await Session.create({ userId: participant2._id, token: 'tok_prt2', expiresAt });
    const sAdm = await Session.create({ userId: admin._id, token: 'tok_admin', expiresAt });

    tokenOrgA = sOrgA.token;
    tokenOrgB = sOrgB.token;
    tokenJudgeA = sJdgA.token;
    tokenJudgeB = sJdgB.token;
    tokenPart1 = sPrt1.token;
    tokenPart2 = sPrt2.token;
    tokenAdmin = sAdm.token;

    // Create Event A (hosted by Organizer A)
    eventA = await Event.create({
      name: 'Alpha Hackathon 2026',
      description: 'Hostile Pen-Testing Target A',
      startDate: new Date(Date.now() - 3600000),
      submissionDeadline: new Date(Date.now() + 3600000),
      endDate: new Date(Date.now() + 7200000),
      status: 'active',
      votingOpenAt: new Date(Date.now() - 100000),
      votingCloseAt: new Date(Date.now() + 100000),
      createdBy: organizerA._id
    });

    // Create Event B (hosted by Organizer B)
    eventB = await Event.create({
      name: 'Beta Hackathon 2026',
      description: 'Hostile Pen-Testing Target B',
      startDate: new Date(Date.now() - 3600000),
      submissionDeadline: new Date(Date.now() + 3600000),
      endDate: new Date(Date.now() + 7200000),
      status: 'active',
      createdBy: organizerB._id
    });

    trackA = await Track.create({ eventId: eventA._id, name: 'AI Track A' });
    trackB = await Track.create({ eventId: eventB._id, name: 'Cyber Track B' });

    teamA = await Team.create({
      eventId: eventA._id,
      name: 'Team Alpha',
      creatorId: participant1._id,
      members: [{ userId: participant1._id, role: 'owner' }]
    });

    teamB = await Team.create({
      eventId: eventB._id,
      name: 'Team Beta',
      creatorId: participant2._id,
      members: [{ userId: participant2._id, role: 'owner' }]
    });

    projectA = await Project.create({
      eventId: eventA._id,
      teamId: teamA._id,
      trackId: trackA._id,
      title: 'Project Alpha Target',
      description: 'Project in Event A',
      status: 'submitted'
    });

    projectB = await Project.create({
      eventId: eventB._id,
      teamId: teamB._id,
      trackId: trackB._id,
      title: 'Project Beta Target',
      description: 'Project in Event B',
      status: 'submitted'
    });

    // Seed evaluation by Judge A on Project A
    await Score.create({
      judgeId: judgeA._id,
      judgeRef: judgeA.email,
      eventId: eventA._id,
      projectId: projectA._id,
      criteria: { technicalInnovation: 9, execution: 8, design: 8, impact: 9, documentation: 8 },
      rawTotal: 84.5,
      weightedScore: 84.5,
      normalizedScore: 84.5
    });
  });

  describe('1. AUTHORIZATION & CROSS-TENANT ISOLATION', () => {
    it('rejects unauthenticated visitor from accessing judging scores with 401', async () => {
      const res = await request(app).get('/api/judge/scores');
      expect(res.status).toBe(401);
    });

    it('rejects participant from accessing judging scores with 403', async () => {
      const res = await request(app)
        .get('/api/judge/scores')
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(403);
    });

    it('rejects participant from exporting CSV evaluation data with 403', async () => {
      const res = await request(app)
        .get('/api/export.csv')
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(403);
    });

    it('rejects judge from exporting CSV evaluation data with 403', async () => {
      const res = await request(app)
        .get('/api/export.csv')
        .set('Authorization', `Bearer ${tokenJudgeA}`);
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from updating Organizer A\'s event with 403', async () => {
      const res = await request(app)
        .put(`/api/events/${eventA._id}`)
        .set('Authorization', `Bearer ${tokenOrgB}`)
        .send({ name: 'Hijacked Event Name' });
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from accessing Organizer A\'s audit logs with 403', async () => {
      const res = await request(app)
        .get(`/api/events/${eventA._id}/audit-logs`)
        .set('Authorization', `Bearer ${tokenOrgB}`);
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from accessing Organizer A\'s participation metrics with 403', async () => {
      const res = await request(app)
        .get(`/api/events/${eventA._id}/metrics`)
        .set('Authorization', `Bearer ${tokenOrgB}`);
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from managing webhooks on Organizer A\'s event with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/webhooks`)
        .set('Authorization', `Bearer ${tokenOrgB}`)
        .send({ targetUrl: 'https://attacker.site/hook' });
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from bulk importing into Organizer A\'s event with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/import`)
        .set('Authorization', `Bearer ${tokenOrgB}`)
        .send({ teams: [{ name: 'Injected Team' }] });
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from bulk exporting Organizer A\'s event with 403', async () => {
      const res = await request(app)
        .get(`/api/events/${eventA._id}/export/full`)
        .set('Authorization', `Bearer ${tokenOrgB}`);
      expect(res.status).toBe(403);
    });

    it('rejects Organizer B from assigning judges to Organizer A\'s event with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/judges/assign`)
        .set('Authorization', `Bearer ${tokenOrgB}`)
        .send({ judgeId: judgeA._id });
      expect(res.status).toBe(403);
    });

    it('Organizer A export only contains projects from Event A, not Event B', async () => {
      const res = await request(app)
        .get('/api/export.csv')
        .set('Authorization', `Bearer ${tokenOrgA}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Project Alpha Target');
      expect(res.text).not.toContain('Project Beta Target');
    });
  });

  describe('2. JUDGING ISOLATION', () => {
    it('Judge A cannot see Judge B scores (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/judge/scores?judge=${judgeB.email}`)
        .set('Authorization', `Bearer ${tokenJudgeA}`);
      expect(res.status).toBe(403);
    });

    it('Judge B cannot see Judge A scores (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/judge/scores?judge=judge_a`)
        .set('Authorization', `Bearer ${tokenJudgeB}`);
      expect(res.status).toBe(403);
    });

    it('Judge query without params only returns judge\'s own evaluations', async () => {
      const res = await request(app)
        .get('/api/judge/scores')
        .set('Authorization', `Bearer ${tokenJudgeB}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0); // Judge B has not scored yet
    });

    it('Participant cannot access judging overview (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/events/${eventA._id}/judging/overview`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(403);
    });

    it('Judge cannot access organizer judging overview (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/events/${eventA._id}/judging/overview`)
        .set('Authorization', `Bearer ${tokenJudgeA}`);
      expect(res.status).toBe(403);
    });

    it('Judge cannot modify another judge\'s score (403 Forbidden)', async () => {
      const existingScore = await Score.findOne({ judgeId: judgeA._id });
      const res = await request(app)
        .put(`/api/judge/scores/${existingScore._id}`)
        .set('Authorization', `Bearer ${tokenJudgeB}`)
        .send({ criteria: { technicalInnovation: 1 } });
      expect(res.status).toBe(403);
    });
  });

  describe('3. VOTING ABUSE & RACE CONDITION RESILIENCE', () => {
    it('rejects duplicate voting by the same voter on the same project with 409 Conflict', async () => {
      // First vote succeeds
      const v1 = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(v1.status).toBe(201);

      // Duplicate vote fails
      const v2 = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(v2.status).toBe(409);
      expect(v2.body.error).toBe('DuplicateVote');
    });

    it('rejects voting when unauthenticated with 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`);
      expect(res.status).toBe(401);
    });

    it('rejects voting before voting opens with 400 VotingNotAllowed', async () => {
      eventA.votingOpenAt = new Date(Date.now() + 100000);
      await eventA.save();

      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VotingNotAllowed');
    });

    it('rejects voting after voting closes with 400 VotingNotAllowed', async () => {
      eventA.votingCloseAt = new Date(Date.now() - 100000);
      await eventA.save();

      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VotingNotAllowed');
    });

    it('rejects vote for project belonging to a different event with 400 EventMismatch', async () => {
      // Attempt to vote on Project B (which is in Event B) using Event A route
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectB._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EventMismatch');
    });

    it('rejects vote on non-existent project with 404', async () => {
      const fakeProjectId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${fakeProjectId}/vote`)
        .set('Authorization', `Bearer ${tokenPart1}`);
      expect(res.status).toBe(404);
    });

    it('allows retracting vote while open and voting again', async () => {
      // Vote
      await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart2}`);

      // Retract
      const r1 = await request(app)
        .delete(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart2}`);
      expect(r1.status).toBe(200);

      // Re-vote succeeds
      const r2 = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart2}`);
      expect(r2.status).toBe(201);
    });

    it('rejects retracting vote after voting has closed with 400 VotingClosed', async () => {
      await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart2}`);

      eventA.votingCloseAt = new Date(Date.now() - 100000);
      await eventA.save();

      const res = await request(app)
        .delete(`/api/events/${eventA._id}/projects/${projectA._id}/vote`)
        .set('Authorization', `Bearer ${tokenPart2}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VotingClosed');
    });
  });

  describe('4. COMMENTS & XSS RESILIENCE', () => {
    it('sanitizes script tags and HTML injection to prevent stored XSS', async () => {
      const xssPayload = '<script>alert("hacked")</script><img src=x onerror=alert(1)>';
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/comments`)
        .set('Authorization', `Bearer ${tokenPart1}`)
        .send({ content: xssPayload });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).not.toContain('<script>');
      expect(res.body.comment.content).toContain('&lt;script&gt;');
      expect(res.body.comment.content).toContain('&lt;img');
    });

    it('rejects empty or whitespace comment with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/comments`)
        .set('Authorization', `Bearer ${tokenPart1}`)
        .send({ content: '   ' });
      expect(res.status).toBe(400);
    });

    it('rejects oversized comment (>1000 chars) with 400', async () => {
      const oversized = 'A'.repeat(1001);
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectA._id}/comments`)
        .set('Authorization', `Bearer ${tokenPart1}`)
        .send({ content: oversized });
      expect(res.status).toBe(400);
    });

    it('rejects commenting on a project from another event with 400 EventMismatch', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/projects/${projectB._id}/comments`)
        .set('Authorization', `Bearer ${tokenPart1}`)
        .send({ content: 'Cross event comment attack' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EventMismatch');
    });

    it('rejects non-author participant from editing another user\'s comment with 403', async () => {
      const comment = await Comment.create({
        eventId: eventA._id,
        projectId: projectA._id,
        authorId: participant1._id,
        content: 'Original comment by participant 1'
      });

      const res = await request(app)
        .put(`/api/comments/${comment._id}`)
        .set('Authorization', `Bearer ${tokenPart2}`)
        .send({ content: 'Malicious edit by participant 2' });

      expect(res.status).toBe(403);
    });

    it('allows author to edit their own comment and sanitizes input', async () => {
      const comment = await Comment.create({
        eventId: eventA._id,
        projectId: projectA._id,
        authorId: participant1._id,
        content: 'Original comment'
      });

      const res = await request(app)
        .put(`/api/comments/${comment._id}`)
        .set('Authorization', `Bearer ${tokenPart1}`)
        .send({ content: 'Updated comment <b>clean</b>' });

      expect(res.status).toBe(200);
      expect(res.body.comment.content).toContain('&lt;b&gt;clean&lt;/b&gt;');
    });

    it('rejects non-author participant from deleting another user\'s comment with 403', async () => {
      const comment = await Comment.create({
        eventId: eventA._id,
        projectId: projectA._id,
        authorId: participant1._id,
        content: 'Protected comment'
      });

      const res = await request(app)
        .delete(`/api/comments/${comment._id}`)
        .set('Authorization', `Bearer ${tokenPart2}`);
      expect(res.status).toBe(403);
    });
  });

  describe('5. BULK IMPORT TRANSACTIONAL INTEGRITY', () => {
    it('leaves ZERO database mutations when bulk import fails validation', async () => {
      const initialTeamsCount = await Team.countDocuments({ eventId: eventA._id });
      const initialProjectsCount = await Project.countDocuments({ eventId: eventA._id });
      const initialTracksCount = await Track.countDocuments({ eventId: eventA._id });

      const malformedPayload = {
        teams: [
          { name: 'Valid Team 1' },
          { name: 'X' } // invalid name: <2 chars
        ],
        projects: [
          { title: 'Valid Project 1' }
        ]
      };

      const res = await request(app)
        .post(`/api/events/${eventA._id}/import`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send(malformedPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ImportValidationError');

      // Database counts must remain strictly identical
      const postTeamsCount = await Team.countDocuments({ eventId: eventA._id });
      const postProjectsCount = await Project.countDocuments({ eventId: eventA._id });
      const postTracksCount = await Track.countDocuments({ eventId: eventA._id });

      expect(postTeamsCount).toBe(initialTeamsCount);
      expect(postProjectsCount).toBe(initialProjectsCount);
      expect(postTracksCount).toBe(initialTracksCount);
    });

    it('rejects payload with duplicate team names with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/import`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({
          teams: [{ name: 'Duplicate Team' }, { name: 'Duplicate Team' }]
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ImportValidationError');
    });

    it('rejects cross-event trackId in project records with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/import`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({
          teams: [{ name: 'Cross Event Team' }],
          projects: [{ title: 'Injected Project', trackId: trackB._id }]
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ImportValidationError');
    });
  });

  describe('6. WEBHOOK SECURITY', () => {
    it('rejects invalid or malformed targetUrl with 400 ValidationError', async () => {
      const res = await request(app)
        .post(`/api/events/${eventA._id}/webhooks`)
        .set('Authorization', `Bearer ${tokenOrgA}`)
        .send({ targetUrl: 'javascript:alert(1)' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('masks secret in webhook list response', async () => {
      await Webhook.create({
        eventId: eventA._id,
        targetUrl: 'https://example.com/receiver',
        secret: 'supersecretkey12345678',
        active: true
      });

      const res = await request(app)
        .get(`/api/events/${eventA._id}/webhooks`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      expect(res.status).toBe(200);
      expect(res.body.webhooks[0].secret).toContain('••••••••');
      expect(res.body.webhooks[0].secret).not.toBe('supersecretkey12345678');
    });
  });

  describe('7. CERTIFICATES & CRYPTOGRAPHIC VERIFICATION', () => {
    it('seals judging records from public during active judging with 403 Forbidden', async () => {
      const res = await request(app).get(`/api/events/${eventA._id}/records/judging`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('detects and rejects a tampered judging manifest with 400', async () => {
      // Organizer can generate official record
      const recordRes = await request(app)
        .get(`/api/events/${eventA._id}/records/judging`)
        .set('Authorization', `Bearer ${tokenOrgA}`);
      expect(recordRes.status).toBe(200);

      // Modify the manifest to falsely inflate an evaluation
      const tampered = JSON.parse(JSON.stringify(recordRes.body.verifiableRecord));
      tampered.results[0].averageScore = 999.0;

      const verifyRes = await request(app)
        .post(`/api/events/${eventA._id}/records/verify`)
        .send({
          manifest: tampered,
          signature: recordRes.body.signature
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.verified).toBe(false);
    });

    it('rejects verifying a record against a different eventId parameter with 400 EventMismatch', async () => {
      const recordRes = await request(app)
        .get(`/api/events/${eventA._id}/records/judging`)
        .set('Authorization', `Bearer ${tokenOrgA}`);

      const verifyRes = await request(app)
        .post(`/api/events/${eventB._id}/records/verify`)
        .send({
          manifest: recordRes.body.verifiableRecord,
          signature: recordRes.body.signature
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error).toBe('EventMismatch');
    });

    it('rejects certificate request for a user not in event teams with 400 CertificateIneligible', async () => {
      const outsider = await User.create({ email: 'outsider@other.com', password: 'password123', role: 'participant' });
      const res = await request(app)
        .get(`/api/events/${eventA._id}/certificates/participation/${outsider._id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CertificateIneligible');
    });
  });

  describe('8. DEADLINES & EVENT LIFECYCLE REJECTIONS', () => {
    it('rejects review submission on a draft event with 400', async () => {
      eventA.status = 'draft';
      await eventA.save();

      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${tokenJudgeB}`)
        .send({
          projectId: projectA._id,
          eventId: eventA._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('draft');
    });

    it('rejects review submission after event has closed with 400', async () => {
      eventA.status = 'closed';
      await eventA.save();

      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${tokenJudgeB}`)
        .send({
          projectId: projectA._id,
          eventId: eventA._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('closed');
    });

    it('rejects review score update after event has ended with 400', async () => {
      const existingScore = await Score.findOne({ judgeId: judgeA._id });

      eventA.status = 'ended';
      await eventA.save();

      const res = await request(app)
        .put(`/api/judge/scores/${existingScore._id}`)
        .set('Authorization', `Bearer ${tokenJudgeA}`)
        .send({ criteria: { technicalInnovation: 10 } });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('closed');
    });
  });
});
