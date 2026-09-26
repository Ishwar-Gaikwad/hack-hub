import request from 'supertest';
import app from '../src/app.js';
import Project from '../src/models/project.model.js';
import Event from '../src/models/event.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Server-Side Submission Deadline Enforcement (T1-06)', () => {
  let organizerToken;
  let participant1Token;
  let participant2Token;
  let nonMemberToken;
  let judgeToken;

  let activeEventId;
  let activeTrackId;
  let activeTeamId;

  let expiredEventId;
  let expiredTrackId;
  let expiredTeamId;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Register accounts
    const orgRes = await request(app).post('/api/auth/register').send({
      email: 'organizer@hackhub.local',
      password: 'password123',
      role: 'organizer'
    });
    organizerToken = orgRes.body.session.token;

    const p1Res = await request(app).post('/api/auth/register').send({
      email: 'p1@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant1Token = p1Res.body.session.token;

    const p2Res = await request(app).post('/api/auth/register').send({
      email: 'p2@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant2Token = p2Res.body.session.token;

    const nonMemberRes = await request(app).post('/api/auth/register').send({
      email: 'outsider@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    nonMemberToken = nonMemberRes.body.session.token;

    const judgeRes = await request(app).post('/api/auth/register').send({
      email: 'judge@hackhub.local',
      password: 'password123',
      role: 'judge'
    });
    judgeToken = judgeRes.body.session.token;

    // 1. Create Active Event (Deadline far in future: 2099)
    const activeEvRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Future Event 2099',
        startDate: new Date('2099-01-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2099-12-01T23:59:59.000Z').toISOString(),
        endDate: new Date('2099-12-31T23:59:59.000Z').toISOString()
      });
    activeEventId = activeEvRes.body.event._id;

    const activeTrackRes = await request(app)
      .post(`/api/events/${activeEventId}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'General Track', description: 'Main track' });
    activeTrackId = activeTrackRes.body.track._id;

    const activeTeamRes = await request(app)
      .post(`/api/events/${activeEventId}/teams`)
      .set('Authorization', `Bearer ${participant1Token}`)
      .send({ name: 'Active Team' });
    activeTeamId = activeTeamRes.body.team._id;

    // Add participant 2 to active team
    const activeInviteRes = await request(app)
      .post(`/api/teams/${activeTeamId}/invites`)
      .set('Authorization', `Bearer ${participant1Token}`);
    await request(app)
      .post('/api/teams/join')
      .set('Authorization', `Bearer ${participant2Token}`)
      .send({ token: activeInviteRes.body.invitation.token });

    // 2. Create Expired Event (Deadline in past: 2020)
    // Note: event creation validation requires startDate < submissionDeadline < endDate
    const expiredEvRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Past Event 2020',
        startDate: new Date('2020-01-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2020-01-10T12:00:00.000Z').toISOString(),
        endDate: new Date('2020-01-15T12:00:00.000Z').toISOString()
      });
    expiredEventId = expiredEvRes.body.event._id;

    const expiredTrackRes = await request(app)
      .post(`/api/events/${expiredEventId}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Retro Track', description: 'Past track' });
    expiredTrackId = expiredTrackRes.body.track._id;

    const expiredTeamRes = await request(app)
      .post(`/api/events/${expiredEventId}/teams`)
      .set('Authorization', `Bearer ${participant1Token}`)
      .send({ name: 'Expired Team' });
    expiredTeamId = expiredTeamRes.body.team._id;

    // Add participant 2 to expired team
    const expiredInviteRes = await request(app)
      .post(`/api/teams/${expiredTeamId}/invites`)
      .set('Authorization', `Bearer ${participant1Token}`);
    await request(app)
      .post('/api/teams/join')
      .set('Authorization', `Bearer ${participant2Token}`)
      .send({ token: expiredInviteRes.body.invitation.token });
  });

  describe('Project Creation Deadline Enforcement', () => {
    it('allows project creation BEFORE submission deadline (future deadline)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: activeEventId,
          teamId: activeTeamId,
          trackId: activeTrackId,
          title: 'Timely Project',
          description: 'Created well before deadline'
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.title).toBe('Timely Project');
      expect(res.body.project.status).toBe('draft');
    });

    it('allows project creation via nested route /api/events/:eventId/projects BEFORE deadline', async () => {
      const res = await request(app)
        .post(`/api/events/${activeEventId}/projects`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          teamId: activeTeamId,
          trackId: activeTrackId,
          title: 'Nested Timely Project'
        });

      expect(res.status).toBe(201);
      expect(res.body.project.status).toBe('draft');
    });

    it('rejects project creation AFTER submission deadline (past deadline) with 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: expiredEventId,
          teamId: expiredTeamId,
          trackId: expiredTrackId,
          title: 'Late Project Attempt',
          description: 'Should be rejected'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DeadlineExceeded');
      expect(res.body.message).toContain('submission deadline');

      // Ensure no project was created in database
      const count = await Project.countDocuments({ eventId: expiredEventId });
      expect(count).toBe(0);
    });

    it('rejects project creation via nested route AFTER submission deadline with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${expiredEventId}/projects`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          teamId: expiredTeamId,
          trackId: expiredTrackId,
          title: 'Late Nested Project Attempt'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DeadlineExceeded');
      expect(res.body.message).toContain('submission deadline');
    });
  });

  describe('Project Editing Deadline Enforcement', () => {
    let activeProjectId;
    let expiredProjectId;

    beforeEach(async () => {
      // Create project in active event
      const pActive = await Project.create({
        eventId: activeEventId,
        teamId: activeTeamId,
        trackId: activeTrackId,
        title: 'Original Active Title',
        description: 'Original description',
        status: 'draft'
      });
      activeProjectId = pActive._id.toString();

      // Create pre-existing draft project in expired event (simulating project created before deadline passed)
      const pExpired = await Project.create({
        eventId: expiredEventId,
        teamId: expiredTeamId,
        trackId: expiredTrackId,
        title: 'Original Expired Title',
        description: 'Original past description',
        repositoryUrl: 'https://github.com/original/repo',
        status: 'draft'
      });
      expiredProjectId = pExpired._id.toString();
    });

    it('allows draft editing BEFORE submission deadline', async () => {
      const res = await request(app)
        .put(`/api/projects/${activeProjectId}`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          title: 'Updated Active Title',
          description: 'Updated active description',
          repositoryUrl: 'https://github.com/new/active'
        });

      expect(res.status).toBe(200);
      expect(res.body.project.title).toBe('Updated Active Title');
      expect(res.body.project.description).toBe('Updated active description');

      const dbProj = await Project.findById(activeProjectId);
      expect(dbProj.title).toBe('Updated Active Title');
    });

    it('rejects draft editing AFTER submission deadline with 400', async () => {
      const res = await request(app)
        .put(`/api/projects/${expiredProjectId}`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          title: 'Tampered Title After Deadline',
          description: 'Tampered description',
          repositoryUrl: 'https://github.com/hacked/repo'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DeadlineExceeded');
      expect(res.body.message).toContain('submission deadline');

      // Verify project data remains completely unchanged
      const dbProj = await Project.findById(expiredProjectId);
      expect(dbProj.title).toBe('Original Expired Title');
      expect(dbProj.description).toBe('Original past description');
      expect(dbProj.repositoryUrl).toBe('https://github.com/original/repo');
    });
  });

  describe('Project Submission Deadline Enforcement', () => {
    let activeProjectId;
    let expiredProjectId;

    beforeEach(async () => {
      const pActive = await Project.create({
        eventId: activeEventId,
        teamId: activeTeamId,
        trackId: activeTrackId,
        title: 'Draft Active Project',
        description: 'Ready to submit',
        status: 'draft'
      });
      activeProjectId = pActive._id.toString();

      const pExpired = await Project.create({
        eventId: expiredEventId,
        teamId: expiredTeamId,
        trackId: expiredTrackId,
        title: 'Draft Expired Project',
        description: 'Unsubmitted draft from past event',
        status: 'draft'
      });
      expiredProjectId = pExpired._id.toString();
    });

    it('allows project submission (draft -> submitted) BEFORE submission deadline', async () => {
      const res = await request(app)
        .post(`/api/projects/${activeProjectId}/submit`)
        .set('Authorization', `Bearer ${participant1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('submitted');
      expect(res.body.message).toContain('submitted successfully');

      const dbProj = await Project.findById(activeProjectId);
      expect(dbProj.status).toBe('submitted');
    });

    it('rejects project submission AFTER submission deadline with 400', async () => {
      const res = await request(app)
        .post(`/api/projects/${expiredProjectId}/submit`)
        .set('Authorization', `Bearer ${participant1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DeadlineExceeded');
      expect(res.body.message).toContain('submission deadline');

      // Verify status is NOT changed to submitted (remains draft)
      const dbProj = await Project.findById(expiredProjectId);
      expect(dbProj.status).toBe('draft');
    });
  });

  describe('Authorization Order & Edge Cases', () => {
    let expiredProjectId;

    beforeEach(async () => {
      const pExpired = await Project.create({
        eventId: expiredEventId,
        teamId: expiredTeamId,
        trackId: expiredTrackId,
        title: 'Auth Test Expired Project',
        status: 'draft'
      });
      expiredProjectId = pExpired._id.toString();
    });

    it('returns 401 for unauthenticated submission attempt even on expired event', async () => {
      const res = await request(app)
        .post(`/api/projects/${expiredProjectId}/submit`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 403 for non-member participant editing attempt even on expired event', async () => {
      const res = await request(app)
        .put(`/api/projects/${expiredProjectId}`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({ title: 'Hacker Edit' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 403 for non-member participant submitting attempt even on expired event', async () => {
      const res = await request(app)
        .post(`/api/projects/${expiredProjectId}/submit`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 403 for judge submitting project', async () => {
      const res = await request(app)
        .post(`/api/projects/${expiredProjectId}/submit`)
        .set('Authorization', `Bearer ${judgeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });
});
