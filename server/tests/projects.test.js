import request from 'supertest';
import app from '../src/app.js';
import Project from '../src/models/project.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Project Submission with Draft and Edit Support (T1-05)', () => {
  let organizerToken;
  let adminToken;
  let judgeToken;
  let participant1Token;
  let participant1Id;
  let participant2Token;
  let participant2Id;
  let otherParticipantToken;

  let event1Id;
  let event2Id;
  let track1Id;
  let trackEvent2Id;
  let team1Id;
  let teamEvent2Id;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Register test accounts
    const orgRes = await request(app).post('/api/auth/register').send({
      email: 'org@hackhub.local',
      password: 'password123',
      role: 'organizer'
    });
    organizerToken = orgRes.body.session.token;

    const admRes = await request(app).post('/api/auth/register').send({
      email: 'admin@hackhub.local',
      password: 'password123',
      role: 'admin'
    });
    adminToken = admRes.body.session.token;

    const judgeRes = await request(app).post('/api/auth/register').send({
      email: 'judge@hackhub.local',
      password: 'password123',
      role: 'judge'
    });
    judgeToken = judgeRes.body.session.token;

    const p1Res = await request(app).post('/api/auth/register').send({
      email: 'p1@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant1Token = p1Res.body.session.token;
    participant1Id = p1Res.body.user._id;

    const p2Res = await request(app).post('/api/auth/register').send({
      email: 'p2@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant2Token = p2Res.body.session.token;
    participant2Id = p2Res.body.user._id;

    const otherRes = await request(app).post('/api/auth/register').send({
      email: 'other@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    otherParticipantToken = otherRes.body.session.token;

    // Create Event 1 and Track 1
    const ev1Res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'AI Hackathon 2026',
        startDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-10-03T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-10-03T22:00:00.000Z').toISOString()
      });
    event1Id = ev1Res.body.event._id;

    const tr1Res = await request(app)
      .post(`/api/events/${event1Id}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'LLM Agents', description: 'Agent track' });
    track1Id = tr1Res.body.track._id;

    // Create Event 2 and Track 2
    const ev2Res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Web3 Hackathon 2026',
        startDate: new Date('2026-11-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-11-03T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-11-03T22:00:00.000Z').toISOString()
      });
    event2Id = ev2Res.body.event._id;

    const tr2Res = await request(app)
      .post(`/api/events/${event2Id}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Smart Contracts', description: 'Solidity track' });
    trackEvent2Id = tr2Res.body.track._id;

    // Create Team 1 in Event 1 with participant 1
    const t1Res = await request(app)
      .post(`/api/events/${event1Id}/teams`)
      .set('Authorization', `Bearer ${participant1Token}`)
      .send({ name: 'Team Alpha' });
    team1Id = t1Res.body.team._id;

    // Add participant 2 to Team 1 via invite
    const inviteRes = await request(app)
      .post(`/api/teams/${team1Id}/invites`)
      .set('Authorization', `Bearer ${participant1Token}`);
    const token = inviteRes.body.invitation.token;

    await request(app)
      .post('/api/teams/join')
      .set('Authorization', `Bearer ${participant2Token}`)
      .send({ token });

    // Create Team in Event 2 for cross-event mismatch checks
    const t2Res = await request(app)
      .post(`/api/events/${event2Id}/teams`)
      .set('Authorization', `Bearer ${otherParticipantToken}`)
      .send({ name: 'Team Beta Event 2' });
    teamEvent2Id = t2Res.body.team._id;
  });

  describe('Project Creation & Drafts', () => {
    it('allows a team member to create a project in draft status', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Autonomous Code Assistant',
          description: 'A coding assistant agent',
          repositoryUrl: 'https://github.com/example/repo'
        });

      expect(res.status).toBe(201);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.title).toBe('Autonomous Code Assistant');
      expect(res.body.project.status).toBe('draft');
      expect(res.body.project.eventId._id.toString()).toBe(event1Id);
      expect(res.body.project.teamId._id.toString()).toBe(team1Id);
      expect(res.body.project.trackId._id.toString()).toBe(track1Id);

      // Verify DB persistence
      const dbProject = await Project.findById(res.body.project._id);
      expect(dbProject).not.toBeNull();
      expect(dbProject.status).toBe('draft');
    });

    it('rejects duplicate project creation for the same team in the same event with 409 Conflict', async () => {
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'First Project'
        });

      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Duplicate Project Attempt'
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('rejects creation when participant does not belong to the team with 403', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${otherParticipantToken}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Unauthorized Project Creation'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects team belonging to a different event with 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${otherParticipantToken}`)
        .send({
          eventId: event1Id,
          teamId: teamEvent2Id, // belongs to event 2
          trackId: track1Id,
          title: 'Mismatched Team Project'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('team does not belong to this event');
    });

    it('rejects track belonging to a different event with 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: trackEvent2Id, // belongs to event 2
          title: 'Mismatched Track Project'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('track does not belong to this event');
    });

    it('rejects non-existent event with 404', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: fakeId,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Orphan Project'
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('rejects unauthenticated visitor with 401', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Anon Project'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects judge from creating a project with 403', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${judgeToken}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Judge Project'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Project Retrieval & Editing', () => {
    let projectId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Initial Draft Title',
          description: 'Initial draft description'
        });
      projectId = res.body.project._id;
    });

    it('retrieves project details by ID', async () => {
      const res = await request(app).get(`/api/projects/${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.project.title).toBe('Initial Draft Title');
      expect(res.body.project.status).toBe('draft');
    });

    it('retrieves project by team ID', async () => {
      const res = await request(app).get(`/api/teams/${team1Id}/project`);
      expect(res.status).toBe(200);
      expect(res.body.project._id.toString()).toBe(projectId);
      expect(res.body.project.title).toBe('Initial Draft Title');
    });

    it('allows any member of the team to edit the project draft', async () => {
      // Participant 2 is also in Team 1
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({
          title: 'Updated Project Title',
          description: 'Updated description by teammate',
          repositoryUrl: 'https://github.com/example/updated'
        });

      expect(res.status).toBe(200);
      expect(res.body.project.title).toBe('Updated Project Title');
      expect(res.body.project.description).toBe('Updated description by teammate');
      expect(res.body.project.repositoryUrl).toBe('https://github.com/example/updated');
    });

    it('rejects a participant from another team from editing the project with 403', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${otherParticipantToken}`)
        .send({
          title: 'Hacked Title'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects organizer from editing a participant project with 403', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ title: 'Organizer Modified' });

      expect(res.status).toBe(403);
    });

    it('rejects admin from editing a participant project with 403', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Modified' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated visitor from editing with 401', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .send({ title: 'Anon Modified' });

      expect(res.status).toBe(401);
    });
  });

  describe('Explicit Project Submission', () => {
    let projectId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({
          eventId: event1Id,
          teamId: team1Id,
          trackId: track1Id,
          title: 'Draft Ready For Submission',
          description: 'Full submission details'
        });
      projectId = res.body.project._id;
    });

    it('allows a team member to explicitly submit the project (draft -> submitted)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${participant1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('submitted');
      expect(res.body.message).toContain('submitted successfully');

      // Verify DB persistence
      const dbProject = await Project.findById(projectId);
      expect(dbProject.status).toBe('submitted');
    });

    it('allows teammate (participant 2) to submit the project', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${participant2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.project.status).toBe('submitted');
    });

    it('rejects a participant from another team from submitting the project with 403', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${otherParticipantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects unauthenticated visitor from submitting with 401', async () => {
      const res = await request(app).post(`/api/projects/${projectId}/submit`);
      expect(res.status).toBe(401);
    });

    it('rejects judge from submitting with 403', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${judgeToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects organizer from submitting participant project with 403', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
