import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Assignment from '../src/models/assignment.model.js';
import Score from '../src/models/score.model.js';
import AuditLog from '../src/models/audit.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Organizer Workspace: Judge Assignment, Lifecycle & Results Verification', () => {
  let organizer, judgeA, judgeB, participant, admin;
  let organizerToken, judgeAToken, judgeBToken, participantToken, adminToken;
  let event, trackAI, trackWeb, team, project1, project2;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // 1. Create Users
    organizer = await User.create({ email: 'organizer@hackhub.local', password: 'password123', role: 'organizer', name: 'Lead Organizer' });
    judgeA = await User.create({ email: 'aarav@hackhub.local', password: 'password123', role: 'judge', name: 'Aarav Sharma' });
    judgeB = await User.create({ email: 'priya@hackhub.local', password: 'password123', role: 'judge', name: 'Priya Shah' });
    participant = await User.create({ email: 'dev@hackhub.local', password: 'password123', role: 'participant', name: 'Developer User' });
    admin = await User.create({ email: 'admin@hackhub.local', password: 'password123', role: 'admin', name: 'System Admin' });

    // 2. Create Sessions
    organizerToken = 'token-org';
    judgeAToken = 'token-judge-a';
    judgeBToken = 'token-judge-b';
    participantToken = 'token-participant';
    adminToken = 'token-admin';

    const expiry = new Date(Date.now() + 86400000);
    await Session.create([
      { userId: organizer._id, token: organizerToken, expiresAt: expiry, isValid: true },
      { userId: judgeA._id, token: judgeAToken, expiresAt: expiry, isValid: true },
      { userId: judgeB._id, token: judgeBToken, expiresAt: expiry, isValid: true },
      { userId: participant._id, token: participantToken, expiresAt: expiry, isValid: true },
      { userId: admin._id, token: adminToken, expiresAt: expiry, isValid: true }
    ]);

    // 3. Create Event
    event = await Event.create({
      name: 'Hackathon 2026',
      description: 'Annual Hackathon',
      startDate: new Date('2026-10-01T09:00:00Z'),
      submissionDeadline: new Date('2026-10-02T17:00:00Z'),
      endDate: new Date('2026-10-03T20:00:00Z'),
      status: 'active',
      createdBy: organizer._id
    });

    // 4. Create Tracks
    trackAI = await Track.create({ eventId: event._id, name: 'AI Track', description: 'Artificial Intelligence' });
    trackWeb = await Track.create({ eventId: event._id, name: 'Web Track', description: 'Modern Web' });

    // 5. Create Team & Projects
    team = await Team.create({
      eventId: event._id,
      name: 'Alpha Team',
      creatorId: participant._id,
      members: [{ userId: participant._id, role: 'owner' }]
    });

    project1 = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: trackAI._id,
      title: 'AI Diagnostic',
      description: 'Healthcare AI',
      repositoryUrl: 'https://github.com/example/ai',
      status: 'submitted'
    });

    project2 = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: trackWeb._id,
      title: 'Web Platform',
      description: 'Distributed web tool',
      repositoryUrl: 'https://github.com/example/web',
      status: 'submitted'
    });
  });

  describe('Judge Assignment Workflow', () => {
    it('allows organizer to assign judge to all event projects', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          judgeId: judgeA._id,
          assignedAll: true
        });

      expect(res.status).toBe(201);
      expect(res.body.assignment).toBeDefined();
      expect(res.body.assignment.assignedAll).toBe(true);

      const dbAssignment = await Assignment.findById(res.body.assignment._id);
      expect(dbAssignment).not.toBeNull();
      expect(dbAssignment.status).toBe('active');
    });

    it('allows organizer to assign judge to a specific track', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          judgeId: judgeB._id,
          trackId: trackAI._id
        });

      expect(res.status).toBe(201);
      expect(res.body.assignment.trackId.toString()).toBe(trackAI._id.toString());
    });

    it('rejects duplicate active judge assignment with 409 Conflict', async () => {
      await Assignment.create({
        eventId: event._id,
        judgeId: judgeA._id,
        status: 'active'
      });

      const res = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          judgeId: judgeA._id,
          assignedAll: true
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('rejects assigning a participant from this event as judge with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          judgeId: participant._id,
          assignedAll: true
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ConflictRole');
    });

    it('rejects track that belongs to another event with 400 Bad Request', async () => {
      const otherEvent = await Event.create({
        name: 'Other Hackathon',
        startDate: new Date('2026-11-01T09:00:00Z'),
        submissionDeadline: new Date('2026-11-02T17:00:00Z'),
        endDate: new Date('2026-11-03T20:00:00Z'),
        status: 'published',
        createdBy: organizer._id
      });
      const otherTrack = await Track.create({ eventId: otherEvent._id, name: 'Other Track' });

      const res = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          judgeId: judgeA._id,
          trackId: otherTrack._id
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Track does not belong to this event');
    });

    it('rejects unauthorized roles from assigning judges', async () => {
      // Participant blocked 403
      const partRes = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ judgeId: judgeA._id, assignedAll: true });
      expect(partRes.status).toBe(403);

      // Public blocked 401
      const pubRes = await request(app)
        .post(`/api/events/${event._id}/judges/assign`)
        .send({ judgeId: judgeA._id, assignedAll: true });
      expect(pubRes.status).toBe(401);
    });

    it('allows organizer to invite a new judge via email', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/judges/invite`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          email: 'newjudge@external.org',
          name: 'External Judge',
          trackId: trackAI._id
        });

      expect(res.status).toBe(201);
      expect(res.body.judge.email).toBe('newjudge@external.org');
      expect(res.body.assignment).toBeDefined();
      expect(res.body.inviteLink).toBeDefined();

      const user = await User.findOne({ email: 'newjudge@external.org' });
      expect(user).not.toBeNull();
      expect(user.role).toBe('judge');
    });

    it('allows organizer to revoke an active judge assignment', async () => {
      await Assignment.create({
        eventId: event._id,
        judgeId: judgeA._id,
        status: 'active'
      });

      const res = await request(app)
        .delete(`/api/events/${event._id}/judges/${judgeA._id}/assignment`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);

      const dbAssignment = await Assignment.findOne({ eventId: event._id, judgeId: judgeA._id });
      expect(dbAssignment.status).toBe('revoked');
    });

    it('returns 404 when revoking an assignment that does not exist', async () => {
      const res = await request(app)
        .delete(`/api/events/${event._id}/judges/${judgeA._id}/assignment`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Judge List & Retrieval', () => {
    it('retrieves event judges with assignment details and review progress', async () => {
      await Assignment.create({
        eventId: event._id,
        judgeId: judgeA._id,
        trackId: trackAI._id,
        status: 'active'
      });

      // Judge A records a score for project1
      await Score.create({
        projectId: project1._id,
        judgeId: judgeA._id,
        eventId: event._id,
        criteria: {
          technicalInnovation: 8,
          execution: 8,
          design: 8,
          impact: 8,
          documentation: 8
        },
        rawTotal: 40,
        weightedScore: 80
      });

      const res = await request(app)
        .get(`/api/events/${event._id}/judges`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.judges)).toBe(true);

      const foundJudgeA = res.body.judges.find(j => j.judgeId.toString() === judgeA._id.toString());
      expect(foundJudgeA).toBeDefined();
      expect(foundJudgeA.track.name).toBe('AI Track');
      expect(foundJudgeA.completedReviewsCount).toBe(1);
    });

    it('lists available judges excluding those already assigned or participating', async () => {
      await Assignment.create({
        eventId: event._id,
        judgeId: judgeA._id,
        status: 'active'
      });

      const res = await request(app)
        .get(`/api/events/${event._id}/judges/available`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      const availableIds = res.body.availableJudges.map(j => j._id.toString());
      expect(availableIds).toContain(judgeB._id.toString());
      expect(availableIds).not.toContain(judgeA._id.toString()); // already assigned
      expect(availableIds).not.toContain(participant._id.toString()); // participant
    });
  });

  describe('Event Lifecycle Status Transitions', () => {
    it('allows valid lifecycle transitions (published -> active -> judging -> voting -> ended -> closed)', async () => {
      const e = await Event.create({
        name: 'Lifecycle Event',
        startDate: new Date('2026-10-01T09:00:00Z'),
        submissionDeadline: new Date('2026-10-02T17:00:00Z'),
        endDate: new Date('2026-10-03T20:00:00Z'),
        status: 'draft',
        createdBy: organizer._id
      });

      // draft -> published
      let res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'published' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('published');

      // published -> active
      res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('active');

      // active -> judging
      res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'judging' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('judging');

      // judging -> voting
      res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'voting' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('voting');

      // voting -> ended
      res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'ended' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('ended');

      // ended -> closed
      res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'closed' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('closed');
    });

    it('rejects invalid status transition (draft directly to closed or ended) with 400', async () => {
      const e = await Event.create({
        name: 'Draft Event',
        startDate: new Date('2026-10-01T09:00:00Z'),
        submissionDeadline: new Date('2026-10-02T17:00:00Z'),
        endDate: new Date('2026-10-03T20:00:00Z'),
        status: 'draft',
        createdBy: organizer._id
      });

      const res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'ended' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
      expect(res.body.message).toContain('Invalid event status transition');
    });

    it('rejects reopening a closed event with 400', async () => {
      const e = await Event.create({
        name: 'Closed Event',
        startDate: new Date('2026-10-01T09:00:00Z'),
        submissionDeadline: new Date('2026-10-02T17:00:00Z'),
        endDate: new Date('2026-10-03T20:00:00Z'),
        status: 'closed',
        createdBy: organizer._id
      });

      const res = await request(app)
        .put(`/api/events/${e._id}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid event status transition');
    });
  });

  describe('Results Publishing Workflow', () => {
    it('requires explicit acknowledgement of warnings when unreviewed projects exist', async () => {
      // 2 projects exist, 0 reviews completed -> unreviewed warnings exist
      const res = await request(app)
        .post(`/api/events/${event._id}/results/publish`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ acknowledgeWarnings: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('UnresolvedWarnings');
      expect(res.body.warnings.unreviewedCount).toBeGreaterThan(0);
    });

    it('allows publishing results when warnings are explicitly acknowledged', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/results/publish`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ acknowledgeWarnings: true });

      expect(res.status).toBe(200);
      expect(res.body.resultsPublished).toBe(true);

      const dbEvent = await Event.findById(event._id);
      expect(dbEvent.resultsPublished).toBe(true);
      expect(dbEvent.resultsPublishedAt).not.toBeNull();
    });
  });
});
