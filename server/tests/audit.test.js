import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import AuditLog from '../src/models/audit.model.js';
import { MemoryRateLimiter, rateLimit } from '../src/middleware/rate-limit.middleware.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('T3.9 Rate Limiting & T3.11/T3.12 Audit Logging & Organizer Metrics', () => {
  let organizer, participant;
  let orgToken, partToken;
  let event;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    organizer = await User.create({ email: 'org@example.com', password: 'password123', role: 'organizer' });
    participant = await User.create({ email: 'p1@example.com', password: 'password123', role: 'participant' });

    const expiresAt = new Date(Date.now() + 86400000);
    const sOrg = await Session.create({ userId: organizer._id, token: 'tok_org', expiresAt });
    const sPart = await Session.create({ userId: participant._id, token: 'tok_part', expiresAt });

    orgToken = sOrg.token;
    partToken = sPart.token;

    event = await Event.create({
      name: 'Hackathon 2026',
      startDate: new Date(),
      submissionDeadline: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 2 * 86400000),
      status: 'published',
      createdBy: organizer._id
    });
  });

  describe('T3.9 Rate Limiting Engine', () => {
    it('correctly tracks requests and limits when exceeding maximum threshold', () => {
      const limiter = new MemoryRateLimiter(60000, 3);
      const key = 'test-client';

      expect(limiter.isLimited(key).limited).toBe(false);
      expect(limiter.isLimited(key).limited).toBe(false);
      expect(limiter.isLimited(key).limited).toBe(false);

      const overflow = limiter.isLimited(key);
      expect(overflow.limited).toBe(true);
      expect(overflow.count).toBe(3);
      expect(overflow.retryAfter).toBeGreaterThan(0);
    });

    it('resets rate limits cleanly', () => {
      const limiter = new MemoryRateLimiter(60000, 2);
      const key = 'test-client-2';

      limiter.isLimited(key);
      limiter.isLimited(key);
      expect(limiter.isLimited(key).limited).toBe(true);

      limiter.reset();
      expect(limiter.isLimited(key).limited).toBe(false);
    });

    it('rateLimit middleware returns 429 Too Many Requests when triggered', async () => {
      const testLimiter = rateLimit({ windowMs: 60000, max: 2, endpointName: 'test_action' });

      // Create dummy express mock
      let callCount = 0;
      const req = {
        user: { _id: participant._id },
        headers: {},
        params: { eventId: event._id },
        ip: '127.0.0.1'
      };

      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, val) { this.headers[name] = val; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
      };

      const next = () => { callCount++; };

      // Request 1: pass
      await testLimiter(req, res, next);
      expect(callCount).toBe(1);

      // Request 2: pass
      await testLimiter(req, res, next);
      expect(callCount).toBe(2);

      // Request 3: blocked with 429
      await testLimiter(req, res, next);
      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('TooManyRequests');
      expect(res.headers['Retry-After']).toBeDefined();

      // Check audit log for rate_limit.triggered
      const audit = await AuditLog.findOne({ action: 'rate_limit.triggered' });
      expect(audit).toBeTruthy();
      expect(audit.actorId.toString()).toBe(participant._id.toString());
    });
  });

  describe('T3.11 & T3.12 Organizer Audit Logs & Metrics View', () => {
    beforeEach(async () => {
      // Seed some audit records
      await AuditLog.create({
        action: 'vote.created',
        actorId: participant._id,
        eventId: event._id,
        metadata: { info: 'sample vote' }
      });
      await AuditLog.create({
        action: 'comment.created',
        actorId: participant._id,
        eventId: event._id,
        metadata: { info: 'sample comment' }
      });
      await AuditLog.create({
        action: 'duplicate_vote.attempted',
        actorId: participant._id,
        eventId: event._id,
        metadata: { info: 'attempt' }
      });
    });

    it('allows organizer to query audit logs with pagination and filters', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/audit-logs?limit=10&page=1`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.logs).toHaveLength(3);
      expect(res.body.logs[0].actor.email).toBe('p1@example.com');
    });

    it('filters audit logs by specific action', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/audit-logs?action=duplicate_vote.attempted`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.logs[0].action).toBe('duplicate_vote.attempted');
    });

    it('rejects participant from viewing audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/audit-logs`)
        .set('Authorization', `Bearer ${partToken}`);

      expect(res.status).toBe(403);
    });

    it('allows organizer to inspect participation and abuse metrics', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/metrics`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe(event._id.toString());
      expect(res.body.security.duplicateVoteAttempts).toBe(1);
      expect(res.body.votingWindow).toHaveProperty('isOpen');
    });

    it('rejects participant from inspecting event metrics with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/metrics`)
        .set('Authorization', `Bearer ${partToken}`);

      expect(res.status).toBe(403);
    });
  });
});
