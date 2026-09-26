import request from 'supertest';
import app from '../src/app.js';
import Prize from '../src/models/prize.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Prize Management (T1-03)', () => {
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
        name: 'Spring Hackathon 2026',
        startDate: new Date('2026-05-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-05-03T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-05-03T22:00:00.000Z').toISOString()
      });
    eventId = eventRes.body.event._id;
  });

  describe('Prize Creation (POST /api/events/:eventId/prizes)', () => {
    it('allows an organizer to create a prize for an event', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: '1st Place Grand Prize',
          description: 'Top overall submission across all tracks',
          value: '$10,000 Cash + Cloud Credits'
        });

      expect(res.status).toBe(201);
      expect(res.body.prize).toBeDefined();
      expect(res.body.prize.name).toBe('1st Place Grand Prize');
      expect(res.body.prize.eventId).toBe(eventId);
      expect(res.body.prize.value).toBe('$10,000 Cash + Cloud Credits');

      // Verify DB persistence
      const dbPrize = await Prize.findById(res.body.prize._id);
      expect(dbPrize).not.toBeNull();
      expect(dbPrize.eventId.toString()).toBe(eventId);
    });

    it('allows an admin to create a prize for an event', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Best Use of AI',
          value: '$2,500'
        });

      expect(res.status).toBe(201);
      expect(res.body.prize.name).toBe('Best Use of AI');
    });

    it('rejects participant attempting to create a prize with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ name: 'Hacked Prize' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects unauthenticated request to create a prize with 401', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .send({ name: 'Anonymous Prize' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 404 when creating a prize for non-existent event', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/events/${fakeId}/prizes`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Orphan Prize' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('Prize Retrieval (GET /api/events/:eventId/prizes)', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Prize 1', value: '$5,000' });

      await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Prize 2', value: '$2,000' });
    });

    it('retrieves all prizes associated with the event', async () => {
      const res = await request(app).get(`/api/events/${eventId}/prizes`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.prizes)).toBe(true);
      expect(res.body.prizes.length).toBe(2);
      expect(res.body.prizes.map(p => p.name)).toEqual(expect.arrayContaining(['Prize 1', 'Prize 2']));
    });
  });

  describe('Prize Updates (PUT /api/events/:eventId/prizes/:prizeId)', () => {
    let prizeId;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Old Prize', value: '$1,000' });
      prizeId = res.body.prize._id;
    });

    it('allows organizer to update prize', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}/prizes/${prizeId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Updated Prize', value: '$3,000' });

      expect(res.status).toBe(200);
      expect(res.body.prize.name).toBe('Updated Prize');
      expect(res.body.prize.value).toBe('$3,000');
    });

    it('rejects unauthorized roles from updating prize with 403', async () => {
      const res = await request(app)
        .put(`/api/events/${eventId}/prizes/${prizeId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ name: 'Hacked Prize' });

      expect(res.status).toBe(403);
    });
  });
});
