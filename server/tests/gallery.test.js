import request from 'supertest';
import app from '../src/app.js';
import Project from '../src/models/project.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Public Project Gallery with Search & Filter (T1-07)', () => {
  let organizerToken;
  let participantToken;
  let judgeToken;
  let adminToken;

  let event1Id;
  let event2Id;
  let track1Id;
  let track2Id;
  let trackEvent2Id;

  let team1Id;
  let team2Id;
  let team3Id;
  let team4Id;

  let submittedProject1Id;
  let submittedProject2Id;
  let submittedProject3Id;
  let draftProjectId;

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

    const partRes = await request(app).post('/api/auth/register').send({
      email: 'participant@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participantToken = partRes.body.session.token;

    // Create Event 1 (AI World Cup)
    const ev1Res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'AI World Cup 2026',
        startDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-10-05T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-10-06T00:00:00.000Z').toISOString()
      });
    event1Id = ev1Res.body.event._id;

    // Create Tracks for Event 1
    const tr1Res = await request(app)
      .post(`/api/events/${event1Id}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Neural Agents', description: 'Autonomous agents track' });
    track1Id = tr1Res.body.track._id;

    const tr2Res = await request(app)
      .post(`/api/events/${event1Id}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Vision AI', description: 'Computer vision track' });
    track2Id = tr2Res.body.track._id;

    // Create Event 2 (Web3 Summit)
    const ev2Res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Web3 Summit 2026',
        startDate: new Date('2026-11-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-11-05T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-11-06T00:00:00.000Z').toISOString()
      });
    event2Id = ev2Res.body.event._id;

    const trEv2Res = await request(app)
      .post(`/api/events/${event2Id}/tracks`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Smart Contracts', description: 'DeFi & protocols' });
    trackEvent2Id = trEv2Res.body.track._id;

    // Create Teams
    const tm1Res = await request(app)
      .post(`/api/events/${event1Id}/teams`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ name: 'Alpha Coders' });
    team1Id = tm1Res.body.team._id;

    const tm2Res = await request(app)
      .post(`/api/events/${event1Id}/teams`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ name: 'Visionary Devs' });
    team2Id = tm2Res.body.team._id;

    const tm3Res = await request(app)
      .post(`/api/events/${event1Id}/teams`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ name: 'Draft Builders' });
    team3Id = tm3Res.body.team._id;

    const tm4Res = await request(app)
      .post(`/api/events/${event2Id}/teams`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ name: 'Web3 Pioneers' });
    team4Id = tm4Res.body.team._id;

    // 1. Submitted Project 1 (Event 1, Track 1 - Neural Agents)
    const p1 = await Project.create({
      eventId: event1Id,
      teamId: team1Id,
      trackId: track1Id,
      title: 'Neural Code Synthesis',
      description: 'Autonomous multi-agent code generator with self-repair capabilities',
      repositoryUrl: 'https://github.com/alphacoders/neural-synth',
      status: 'submitted'
    });
    submittedProject1Id = p1._id.toString();

    // 2. Submitted Project 2 (Event 1, Track 2 - Vision AI)
    const p2 = await Project.create({
      eventId: event1Id,
      teamId: team2Id,
      trackId: track2Id,
      title: 'Visionary Defect Scanner',
      description: 'Real-time manufacturing defect detection using edge neural vision',
      repositoryUrl: 'https://github.com/visionary/defect-scanner',
      status: 'submitted'
    });
    submittedProject2Id = p2._id.toString();

    // 3. Submitted Project 3 (Event 2, Track: Smart Contracts)
    const p3 = await Project.create({
      eventId: event2Id,
      teamId: team4Id,
      trackId: trackEvent2Id,
      title: 'ZeroKnowledge Oracle Synthesizer',
      description: 'Decentralized ZK oracle for high-frequency algorithmic finance',
      repositoryUrl: 'https://github.com/web3pioneers/zk-oracle',
      status: 'submitted'
    });
    submittedProject3Id = p3._id.toString();

    // 4. Draft Project (Event 1, Track 1 - Should NOT appear in public gallery)
    const pDraft = await Project.create({
      eventId: event1Id,
      teamId: team3Id,
      trackId: track1Id,
      title: 'Work In Progress Secret Idea',
      description: 'Unsubmitted draft project that must remain hidden from gallery',
      repositoryUrl: 'https://github.com/draft/secret',
      status: 'draft'
    });
    draftProjectId = pDraft._id.toString();
  });

  describe('Public Gallery Access & Authentication Rules', () => {
    it('allows unauthenticated visitors to GET /api/projects with 200 OK', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();
      expect(Array.isArray(res.body.projects)).toBe(true);
      expect(res.body.count).toBe(3);
    });

    it('allows unauthenticated visitors to GET /api/projects/gallery with 200 OK', async () => {
      const res = await request(app).get('/api/projects/gallery');
      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();
      expect(res.body.count).toBe(3);
    });

    it('allows unauthenticated visitors to GET /api/events/:eventId/projects with 200 OK', async () => {
      const res = await request(app).get(`/api/events/${event1Id}/projects`);
      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();
      expect(res.body.count).toBe(2);
    });

    it('allows authenticated participants to view gallery with 200 OK', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${participantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('allows judges to view gallery with 200 OK', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${judgeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('allows organizers to view gallery with 200 OK', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${organizerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('allows admins to view gallery with 200 OK', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });
  });

  describe('Project Visibility Rules', () => {
    it('returns all SUBMITTED projects in public gallery', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);

      const titles = res.body.projects.map((p) => p.title);
      expect(titles).toContain('Neural Code Synthesis');
      expect(titles).toContain('Visionary Defect Scanner');
      expect(titles).toContain('ZeroKnowledge Oracle Synthesizer');
    });

    it('strictly excludes DRAFT projects from public gallery', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);

      const titles = res.body.projects.map((p) => p.title);
      expect(titles).not.toContain('Work In Progress Secret Idea');

      const ids = res.body.projects.map((p) => p._id.toString());
      expect(ids).not.toContain(draftProjectId);
    });
  });

  describe('Search Functionality', () => {
    it('searches projects by title keyword (case-insensitive)', async () => {
      const res = await request(app).get('/api/projects?q=neural');
      expect(res.status).toBe(200);

      const titles = res.body.projects.map((p) => p.title);
      expect(titles).toContain('Neural Code Synthesis');
      // Matches description of Visionary Defect Scanner ("edge neural vision")
      expect(titles).toContain('Visionary Defect Scanner');
      expect(titles).not.toContain('ZeroKnowledge Oracle Synthesizer');
      expect(titles).not.toContain('Work In Progress Secret Idea');
    });

    it('searches projects by description keyword', async () => {
      const res = await request(app).get('/api/projects?q=manufacturing');
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(1);
      expect(res.body.projects[0].title).toBe('Visionary Defect Scanner');
    });

    it('returns empty array when search query matches no projects', async () => {
      const res = await request(app).get('/api/projects?q=nonexistentterm12345');
      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });

    it('handles empty query parameter gracefully by returning all submitted projects', async () => {
      const res = await request(app).get('/api/projects?q=   ');
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(3);
    });
  });

  describe('Filtering Functionality', () => {
    it('filters projects by eventId', async () => {
      const res = await request(app).get(`/api/projects?eventId=${event1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(2);

      const titles = res.body.projects.map((p) => p.title);
      expect(titles).toContain('Neural Code Synthesis');
      expect(titles).toContain('Visionary Defect Scanner');
      expect(titles).not.toContain('ZeroKnowledge Oracle Synthesizer');
    });

    it('filters projects by trackId', async () => {
      const res = await request(app).get(`/api/projects?trackId=${track1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(1);
      expect(res.body.projects[0].title).toBe('Neural Code Synthesis');
    });

    it('rejects invalid eventId format with 400 Bad Request', async () => {
      const res = await request(app).get('/api/projects?eventId=invalid-hex');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });

    it('rejects invalid trackId format with 400 Bad Request', async () => {
      const res = await request(app).get('/api/projects?trackId=invalid-track');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });
  });

  describe('Combined Search and Filter', () => {
    it('applies search, eventId, and trackId simultaneously', async () => {
      const res = await request(app).get(
        `/api/projects?q=neural&eventId=${event1Id}&trackId=${track1Id}`
      );
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(1);
      expect(res.body.projects[0].title).toBe('Neural Code Synthesis');
    });

    it('returns empty when filter and search conditions conflict', async () => {
      // Searching for ZK oracle (event 2) while filtering for event 1
      const res = await request(app).get(
        `/api/projects?q=ZeroKnowledge&eventId=${event1Id}`
      );
      expect(res.status).toBe(200);
      expect(res.body.projects.length).toBe(0);
    });
  });

  describe('Security and Information Hygiene', () => {
    it('does not expose password hashes, tokens, or sessions in public gallery response', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);

      const rawJson = JSON.stringify(res.body);
      expect(rawJson).not.toContain('password');
      expect(rawJson).not.toContain('token');
      expect(rawJson).not.toContain('session');
      expect(rawJson).not.toContain('secret');
    });

    it('returns properly populated event, track, and team fields for public display', async () => {
      const res = await request(app).get('/api/projects');
      const project = res.body.projects.find((p) => p.title === 'Neural Code Synthesis');

      expect(project).toBeDefined();
      expect(project.eventId).toBeDefined();
      expect(project.eventId.name).toBe('AI World Cup 2026');
      expect(project.trackId).toBeDefined();
      expect(project.trackId.name).toBe('Neural Agents');
      expect(project.teamId).toBeDefined();
      expect(project.teamId.name).toBe('Alpha Coders');
      expect(project.repositoryUrl).toBe('https://github.com/alphacoders/neural-synth');
      expect(project.status).toBe('submitted');
    });
  });
});
