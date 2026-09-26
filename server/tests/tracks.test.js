import request from 'supertest';
import app from '../src/app.js';
import Track from '../src/models/track.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Track Management (T1-03)', () => {
  let organizerToken;
  let adminToken;
  let participantToken;
  let judgeToken;
  let eventId;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Register test users
    const orgRes = await request(app).post('/api/auth/register').send({
      email: 'org@hackhub.local',
      password: 'password123',
      role: 'organizer'
    });
    organizerToken = orgRes.body.session.token;

    const admRes = await request(app).post('/api/auth/register').send({
      email: 'adm@hackhub.local',
      password: 'password123',
      role: 'admin'
    });
    adminToken = admRes.body.session.token;

    const partRes = await request(app).post('/api/auth/register').send({
      email: 'part@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participantToken = partRes.body.session.token;

    const judgeRes = await request(app).post('/api/auth/register').send({
      email: 'judge@hackhub.local',
      password: 'password123',
      role: 'judge'
    });
    judgeToken = judgeRes.body.session.token;

    // Create a base event
    const eventRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'AI Agents Hackathon',
        startDate: new Date('2026-11-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-11-02T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-11-02T22:00:00.000Z').toISOString()
      });
    eventId = eventRes.body.event._id;
  });

  describe('Track Creation (POST /api/events/:eventId/tracks)', () => {
    it('allows an organizer to create a track for an event', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'Autonomous Agents',
          description: 'Build self-directed AI agents solving real world problems'
        });

      expect(res.status).toBe(201);
      expect(res.body.track).toBeDefined();
      expect(res.body.track.name).toBe('Autonomous Agents');
      expect(res.body.track.eventId).toBe(eventId);

      // Verify DB persistence
      const dbTrack = await Track.findById(res.body.track._id);
      expect(dbTrack).not.toBeNull();
      expect(dbTrack.eventId.toString()).toBe(eventId);
    });

    it('allows an admin to create a track for an event', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Developer Tools',
          description: 'Novel developer tooling with AI'
        });

      expect(res.status).toBe(201);
      expect(res.body.track.name).toBe('Developer Tools');
    });

    it('rejects participant attempting to create a track with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ name: 'Hacked Track' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects unauthenticated request to create a track with 401', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .send({ name: 'Anonymous Track' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects duplicate track name within the same event with 409 Conflict', async () => {
      await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'AI Safety' });

      const duplicateRes = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'AI Safety' });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toBe('Conflict');
    });

    it('returns 404 when creating a track for non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/events/${fakeId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Orphan Track' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('Track Retrieval (GET /api/events/:eventId/tracks)', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Track A', description: 'Description A' });

      await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Track B', description: 'Description B' });
    });

    it('retrieves all tracks associated with the event', async () => {
      const res = await request(app).get(`/api/events/${eventId}/tracks`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tracks)).toBe(true);
      expect(res.body.tracks.length).toBe(2);
      expect(res.body.tracks.map(t => t.name)).toEqual(expect.arrayContaining(['Track A', 'Track B']));
    });
  });

  describe('Track Updates (PUT /api/events/:eventId/tracks/:trackId)', () => {
    let trackId;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Old Track Name', description: 'Old Description' });
      trackId = res.body.track._id;
    });

    it('allows organizer to update track', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}/tracks/${trackId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'New Track Name', description: 'New Description' });

      expect(res.status).toBe(200);
      expect(res.body.track.name).toBe('New Track Name');
      expect(res.body.track.description).toBe('New Description');
    });

    it('rejects unauthorized roles from updating track with 403', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}/tracks/${trackId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ name: 'Hacked Track' });

      expect(res.status).toBe(403);
    });
  });
});
