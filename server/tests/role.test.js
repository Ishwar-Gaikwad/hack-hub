import request from 'supertest';
import app from '../src/app.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Role-Based Access Control (RBAC)', () => {
  let participantToken;
  let judgeToken;
  let organizerToken;
  let adminToken;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Create participant user
    const pRes = await request(app).post('/api/auth/register').send({
      email: 'p@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participantToken = pRes.body.session.token;

    // Create judge user
    const jRes = await request(app).post('/api/auth/register').send({
      email: 'j@hackhub.local',
      password: 'password123',
      role: 'judge'
    });
    judgeToken = jRes.body.session.token;

    // Create organizer user
    const oRes = await request(app).post('/api/auth/register').send({
      email: 'o@hackhub.local',
      password: 'password123',
      role: 'organizer'
    });
    organizerToken = oRes.body.session.token;

    // Create admin user
    const aRes = await request(app).post('/api/auth/register').send({
      email: 'a@hackhub.local',
      password: 'password123',
      role: 'admin'
    });
    adminToken = aRes.body.session.token;
  });

  describe('Unauthenticated Access (Visitor)', () => {
    it('returns 401 Unauthorized for any protected role check without a token', async () => {
      const endpoints = [
        '/api/auth/role-check/participant',
        '/api/auth/role-check/judge',
        '/api/auth/role-check/organizer',
        '/api/auth/role-check/admin',
        '/api/auth/role-check/staff'
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
      }
    });
  });

  describe('Participant Role Authorization', () => {
    it('allows participant to access participant-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/participant')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
      expect(res.body.role).toBe('participant');
    });

    it('rejects participant accessing judge-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/judge')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects participant accessing organizer-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/organizer')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects participant accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/admin')
        .set('Authorization', `Bearer ${participantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Judge Role Authorization', () => {
    it('allows judge to access judge-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/judge')
        .set('Authorization', `Bearer ${judgeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
      expect(res.body.role).toBe('judge');
    });

    it('rejects judge accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/admin')
        .set('Authorization', `Bearer ${judgeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Organizer Role Authorization', () => {
    it('allows organizer to access organizer-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/organizer')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
      expect(res.body.role).toBe('organizer');
    });

    it('allows organizer to access multi-role staff endpoint (organizer, admin)', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/staff')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
    });

    it('rejects organizer accessing admin-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/admin')
        .set('Authorization', `Bearer ${organizerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Admin Role Authorization', () => {
    it('allows admin to access admin-only endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
      expect(res.body.role).toBe('admin');
    });

    it('allows admin to access multi-role staff endpoint', async () => {
      const res = await request(app)
        .get('/api/auth/role-check/staff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('granted');
    });
  });
});
