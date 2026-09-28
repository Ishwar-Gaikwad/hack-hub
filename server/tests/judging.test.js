import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Score, { calculateWeightedScore } from '../src/models/score.model.js';
import AuditLog from '../src/models/audit.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('T2 & Judging Engine Comprehensive Verification', () => {
  let organizer, judgeA, judgeB, participant, admin;
  let organizerToken, judgeAToken, judgeBToken, participantToken, adminToken;
  let event, track, team, project1, project2, draftProject, closedEvent, closedProject;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // 1. Create Users
    organizer = await User.create({ email: 'org@hackhub.local', password: 'password123', role: 'organizer' });
    judgeA = await User.create({ email: 'judge_a@hackhub.local', password: 'password123', role: 'judge' });
    judgeB = await User.create({ email: 'judge_b@hackhub.local', password: 'password123', role: 'judge' });
    participant = await User.create({ email: 'coder@hackhub.local', password: 'password123', role: 'participant' });
    admin = await User.create({ email: 'admin@hackhub.local', password: 'password123', role: 'admin' });

    // 2. Create Sessions
    organizerToken = 'test-token-org';
    judgeAToken = 'test-token-judge-a';
    judgeBToken = 'test-token-judge-b';
    participantToken = 'test-token-participant';
    adminToken = 'test-token-admin';

    const expiry = new Date(Date.now() + 86400000);
    await Session.create([
      { userId: organizer._id, token: organizerToken, expiresAt: expiry, isValid: true },
      { userId: judgeA._id, token: judgeAToken, expiresAt: expiry, isValid: true },
      { userId: judgeB._id, token: judgeBToken, expiresAt: expiry, isValid: true },
      { userId: participant._id, token: participantToken, expiresAt: expiry, isValid: true },
      { userId: admin._id, token: adminToken, expiresAt: expiry, isValid: true }
    ]);

    // 3. Create Events, Tracks, Teams, Projects
    event = await Event.create({
      name: 'Hackathon 2026',
      description: 'Active event for judging verification',
      startDate: new Date('2026-01-01'),
      submissionDeadline: new Date('2026-02-01'),
      endDate: new Date('2026-02-10'),
      status: 'active',
      createdBy: organizer._id
    });

    track = await Track.create({ eventId: event._id, name: 'AI & Tools' });
    team = await Team.create({
      eventId: event._id,
      name: 'Team Alpha',
      creatorId: participant._id,
      members: [{ userId: participant._id, role: 'owner' }]
    });

    project1 = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: track._id,
      title: 'Alpha AI Tool',
      description: 'An AI assistant tool',
      status: 'submitted'
    });

    project2 = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: track._id,
      title: 'Beta Security Platform',
      description: 'A security scanner',
      status: 'submitted'
    });

    draftProject = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: track._id,
      title: 'Unsubmitted Work',
      description: 'Draft not ready',
      status: 'draft'
    });

    closedEvent = await Event.create({
      name: 'Closed Hackathon',
      startDate: new Date('2025-01-01'),
      submissionDeadline: new Date('2025-01-05'),
      endDate: new Date('2025-01-10'),
      status: 'closed',
      createdBy: organizer._id
    });

    closedProject = await Project.create({
      eventId: closedEvent._id,
      teamId: team._id,
      trackId: track._id,
      title: 'Closed Event Project',
      status: 'submitted'
    });
  });

  describe('Weighted Score Calculation', () => {
    it('calculates weighted score according to JUDGING.md (25%, 25%, 20%, 20%, 10%)', () => {
      // 10 across all 5 dimensions = 100
      const perfect = calculateWeightedScore({
        technicalInnovation: 10,
        execution: 10,
        design: 10,
        impact: 10,
        documentation: 10
      });
      expect(perfect).toBe(100);

      // 8, 9, 7, 8, 8 -> (8*2.5) + (9*2.5) + (7*2) + (8*2) + (8*1) = 20 + 22.5 + 14 + 16 + 8 = 80.5
      const score = calculateWeightedScore({
        technicalInnovation: 8,
        execution: 9,
        design: 7,
        impact: 8,
        documentation: 8
      });
      expect(score).toBe(80.5);
    });

    it('gracefully handles legacy 3-criterion inputs', () => {
      const legacy = calculateWeightedScore({
        functionality: 4,
        quality: 4,
        innovation: 4
      });
      expect(legacy).toBe(40);
    });
  });

  describe('Judge Isolation & Role Security Boundary (Section 5)', () => {
    beforeEach(async () => {
      await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 },
        rawTotal: 80,
        weightedScore: 80
      });
    });

    it('Judge sees own score', async () => {
      const res = await request(app)
        .get('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.judge).toBe(judgeA.email);
      expect(res.body.count).toBe(1);
      expect(res.body.scores[0].projectId._id).toBe(project1._id.toString());
    });

    it('Judge A cannot see Judge B scores (rejects with 403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/judge/scores?judge=${judgeB.email}`)
        .set('Authorization', `Bearer ${judgeAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('Judge B cannot see Judge A scores (rejects with 403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/judge/scores?judge=judge_a`)
        .set('Authorization', `Bearer ${judgeBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('Participant cannot see judge scores (rejects with 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/judge/scores')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('Public visitor cannot see judge scores (rejects with 401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/judge/scores');

      expect(res.status).toBe(401);
    });

    it('Organizer can access permitted aggregate CSV data', async () => {
      const res = await request(app)
        .get('/api/export.csv')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Alpha AI Tool');
    });
  });

  describe('Judge Dashboard & Projects Workflow (Section 2, 3, 4)', () => {
    it('returns assigned projects and progress percentage for the judge', async () => {
      // Judge A has evaluated project1, but not project2
      await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 9, execution: 9, design: 8, impact: 9, documentation: 9 },
        rawTotal: 88,
        weightedScore: 88
      });

      const res = await request(app)
        .get(`/api/judge/projects?eventId=${event._id}`)
        .set('Authorization', `Bearer ${judgeAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.totalAssigned).toBe(2);
      expect(res.body.stats.completedCount).toBe(1);
      expect(res.body.stats.remainingCount).toBe(1);
      expect(res.body.stats.progressPercentage).toBe(50);

      // Verify draft project is excluded from assigned projects
      const ids = res.body.projects.map(p => p._id);
      expect(ids).toContain(project1._id.toString());
      expect(ids).toContain(project2._id.toString());
      expect(ids).not.toContain(draftProject._id.toString());

      // Verify reviewed state on project1
      const p1 = res.body.projects.find(p => p._id === project1._id.toString());
      expect(p1.isReviewed).toBe(true);
      expect(p1.myScore.weightedScore).toBe(88);

      // Verify unreviewed state on project2
      const p2 = res.body.projects.find(p => p._id === project2._id.toString());
      expect(p2.isReviewed).toBe(false);
      expect(p2.myScore).toBeNull();
    });

    it('rejects incomplete review (missing criteria or out of bounds)', async () => {
      // Missing criteria
      const res1 = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: project2._id,
          eventId: event._id,
          criteria: { technicalInnovation: 8 } // incomplete
        });

      expect(res1.status).toBe(400);
      expect(res1.body.error).toBe('IncompleteReview');

      // Score out of 1-10 bounds
      const res2 = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: project2._id,
          eventId: event._id,
          criteria: { technicalInnovation: 15, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toBe('InvalidScore');
    });

    it('submits a valid review, computes weighted score, and creates audit log', async () => {
      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeBToken}`)
        .send({
          projectId: project1._id,
          eventId: event._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 },
          comment: 'Very solid implementation.'
        });

      expect(res.status).toBe(201);
      expect(res.body.score.weightedScore).toBe(80);
      expect(res.body.score.comment).toBe('Very solid implementation.');

      // Check audit log
      const log = await AuditLog.findOne({ action: 'review.submitted', projectId: project1._id });
      expect(log).not.toBeNull();
      expect(log.actorId.toString()).toBe(judgeB._id.toString());
    });

    it('rejects duplicate review submission for the same project by the same judge (Section 11)', async () => {
      // First review
      await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: project1._id,
          eventId: event._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      // Duplicate attempt
      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: project1._id,
          eventId: event._id,
          criteria: { technicalInnovation: 9, execution: 9, design: 9, impact: 9, documentation: 9 }
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('DuplicateReview');
    });

    it('rejects review on unsubmitted draft project', async () => {
      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: draftProject._id,
          eventId: event._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot evaluate an unsubmitted project draft');
    });

    it('rejects review after judging is closed for the event (Section 11)', async () => {
      const res = await request(app)
        .post('/api/judge/scores')
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          projectId: closedProject._id,
          eventId: closedEvent._id,
          criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Judging is closed for this event');
    });

    it('allows author judge to update their own review', async () => {
      const score = await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 7, execution: 7, design: 7, impact: 7, documentation: 7 },
        rawTotal: 70,
        weightedScore: 70
      });

      const res = await request(app)
        .put(`/api/judge/scores/${score._id}`)
        .set('Authorization', `Bearer ${judgeAToken}`)
        .send({
          criteria: { technicalInnovation: 9, execution: 9, design: 9, impact: 9, documentation: 9 },
          comment: 'Upgraded review after thorough demo review.'
        });

      expect(res.status).toBe(200);
      expect(res.body.score.weightedScore).toBe(90);
      expect(res.body.score.comment).toBe('Upgraded review after thorough demo review.');
    });

    it('rejects another judge from updating a peer score', async () => {
      const score = await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 7, execution: 7, design: 7, impact: 7, documentation: 7 },
        rawTotal: 70,
        weightedScore: 70
      });

      const res = await request(app)
        .put(`/api/judge/scores/${score._id}`)
        .set('Authorization', `Bearer ${judgeBToken}`)
        .send({
          comment: 'Tampering attempt'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Organizer Fairness, Zero-Variance & Discrepancy Detection (Section 6, 7, 8, 9)', () => {
    it('explicitly handles a zero-variance judge without producing NaN or Infinity (Section 7)', async () => {
      // Judge A gives every single project the exact same score of 7 across the board (stdDev = 0)
      await Score.create([
        {
          judgeId: judgeA._id,
          judgeRef: judgeA.email,
          eventId: event._id,
          projectId: project1._id,
          criteria: { technicalInnovation: 7, execution: 7, design: 7, impact: 7, documentation: 7 },
          rawTotal: 70,
          weightedScore: 70
        },
        {
          judgeId: judgeA._id,
          judgeRef: judgeA.email,
          eventId: event._id,
          projectId: project2._id,
          criteria: { technicalInnovation: 7, execution: 7, design: 7, impact: 7, documentation: 7 },
          rawTotal: 70,
          weightedScore: 70
        }
      ]);

      const res = await request(app)
        .get(`/api/events/${event._id}/judging/overview`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.progress.totalReviews).toBe(2);

      const judgeAStats = res.body.judgeProgress.find(j => j.email === judgeA.email);
      expect(judgeAStats).toBeDefined();
      expect(judgeAStats.isZeroVariance).toBe(true);
      expect(judgeAStats.stdDev).toBe(0);

      // Verify that no NaN or Infinity is present anywhere in rankings
      for (const item of res.body.leaderboard) {
        expect(Number.isFinite(item.rawAverage)).toBe(true);
        expect(Number.isFinite(item.adjustedScore)).toBe(true);
        expect(Number.isFinite(item.finalScore)).toBe(true);
        expect(isNaN(item.finalScore)).toBe(false);
      }
    });

    it('detects and flags score discrepancies where difference on any criterion > 2.0 (Section 8)', async () => {
      // Judge A rates Functionality/Execution at 9
      await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 9, execution: 9, design: 8, impact: 8, documentation: 8 },
        rawTotal: 85,
        weightedScore: 85
      });

      // Judge B rates Functionality/Execution at 5 (Difference: 4.0 > 2.0)
      await Score.create({
        judgeId: judgeB._id,
        judgeRef: judgeB.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 8, execution: 5, design: 7, impact: 7, documentation: 7 },
        rawTotal: 69,
        weightedScore: 69
      });

      const res = await request(app)
        .get(`/api/events/${event._id}/judging/overview`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.discrepancies.length).toBeGreaterThan(0);

      const flagged = res.body.discrepancies.find(d => d.projectId === project1._id.toString());
      expect(flagged).toBeDefined();
      expect(flagged.criterionKey).toBe('execution');
      expect(flagged.difference).toBe(4);
      expect(flagged.scoreA).toBe(9);
      expect(flagged.scoreB).toBe(5);

      // Verify project in leaderboard has hasDiscrepancy: true
      const p1Rank = res.body.leaderboard.find(p => p.projectId === project1._id.toString());
      expect(p1Rank.hasDiscrepancy).toBe(true);

      // Attention summary includes discrepancy
      expect(res.body.attention.discrepanciesCount).toBeGreaterThan(0);
    });

    it('flags projects with missing judge evaluations in attention list (Section 9)', async () => {
      // project1 has 1 review; project2 has 0 reviews
      await Score.create({
        judgeId: judgeA._id,
        judgeRef: judgeA.email,
        eventId: event._id,
        projectId: project1._id,
        criteria: { technicalInnovation: 8, execution: 8, design: 8, impact: 8, documentation: 8 },
        rawTotal: 80,
        weightedScore: 80
      });

      const res = await request(app)
        .get(`/api/events/${event._id}/judging/overview`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      // Both project1 (< 2 reviews) and project2 (0 reviews) require attention
      expect(res.body.attention.insufficientReviewsCount).toBe(2);
      expect(res.body.attention.incompleteCount).toBe(1);
    });

    it('rejects participant and unauthenticated visitors from organizer judging overview', async () => {
      const resPart = await request(app)
        .get(`/api/events/${event._id}/judging/overview`)
        .set('Authorization', `Bearer ${participantToken}`);
      expect(resPart.status).toBe(403);

      const resAnon = await request(app)
        .get(`/api/events/${event._id}/judging/overview`);
      expect(resAnon.status).toBe(401);
    });
  });
});
