import request from 'supertest';
import app from '../src/app.js';
import Event from '../src/models/event.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Event Management (T1-03)', () => {
  let organizerToken;
  let adminToken;
  let participantToken;
  let judgeToken;

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
  });

  const validEventPayload = {
    name: 'HackAI 2026',
    description: 'Annual AI & Agentic Innovation Hackathon',
    startDate: new Date('2026-10-01T09:00:00.000Z').toISOString(),
    submissionDeadline: new Date('2026-10-03T17:00:00.000Z').toISOString(),
    endDate: new Date('2026-10-03T20:00:00.000Z').toISOString(),
    status: 'published'
  };

  describe('Event Creation (POST /api/events)', () => {
    it('allows an organizer to create an event', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(validEventPayload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Event created successfully');
      expect(res.body.event).toBeDefined();
      expect(res.body.event.name).toBe('HackAI 2026');
      expect(res.body.event.status).toBe('published');
      expect(res.body.event.startDate).toBe(validEventPayload.startDate);
      expect(res.body.event.submissionDeadline).toBe(validEventPayload.submissionDeadline);
      expect(res.body.event.endDate).toBe(validEventPayload.endDate);
      expect(res.body.event.createdBy).toBeDefined();

      // DB check
      const dbEvent = await Event.findById(res.body.event._id);
      expect(dbEvent).not.toBeNull();
      expect(dbEvent.name).toBe('HackAI 2026');
    });

    it('allows an admin to create an event', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validEventPayload);

      expect(res.status).toBe(201);
      expect(res.body.event.name).toBe('HackAI 2026');
    });

    it('rejects participant attempting to create an event with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${participantToken}`)
        .send(validEventPayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects judge attempting to create an event with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${judgeToken}`)
        .send(validEventPayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects unauthenticated visitor attempting to create an event with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/events')
        .send(validEventPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects missing event name with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          ...validEventPayload,
          name: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });

    it('rejects inverted dates (start date after submission deadline) with 400', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          ...validEventPayload,
          startDate: new Date('2026-10-05T09:00:00.000Z').toISOString(),
          submissionDeadline: new Date('2026-10-03T17:00:00.000Z').toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('submission deadline');
    });

    it('rejects submission deadline after end date with 400', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          ...validEventPayload,
          submissionDeadline: new Date('2026-10-04T12:00:00.000Z').toISOString(),
          endDate: new Date('2026-10-03T20:00:00.000Z').toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('end date');
    });
  });

  describe('Event Retrieval (GET /api/events & GET /api/events/:id)', () => {
    let createdEventId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(validEventPayload);
      createdEventId = res.body.event._id;
    });

    it('allows public retrieval of all events', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].name).toBe('HackAI 2026');
    });

    it('allows public retrieval of a specific event with tracks and prizes', async () => {
      const res = await request(app).get(`/api/events/${createdEventId}`);
      expect(res.status).toBe(200);
      expect(res.body.event).toBeDefined();
      expect(res.body.event._id).toBe(createdEventId);
      expect(Array.isArray(res.body.event.tracks)).toBe(true);
      expect(Array.isArray(res.body.event.prizes)).toBe(true);
    });

    it('returns 404 for non-existent event ID', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/events/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('returns 400 for malformed event ID', async () => {
      const res = await request(app).get('/api/events/invalid-id-format');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });
  });

  describe('Event Updates (PUT /api/events/:id)', () => {
    let createdEventId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(validEventPayload);
      createdEventId = res.body.event._id;
    });

    it('allows organizer to update event details', async () => {
      const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          name: 'HackAI 2026 - Global Edition',
          description: 'Updated description'
        });

      expect(res.status).toBe(200);
      expect(res.body.event.name).toBe('HackAI 2026 - Global Edition');
      expect(res.body.event.description).toBe('Updated description');
    });

    it('allows admin to update event details', async () => {
      const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ended'
        });

      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('ended');
    });

    it('rejects participant attempting to update event with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ name: 'Hacked Event' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request attempting to update event with 401', async () => {
      const res = await request(app)
        .put(`/api/events/${createdEventId}`)
        .send({ name: 'Hacked Event' });

      expect(res.status).toBe(401);
    });
  });
});
