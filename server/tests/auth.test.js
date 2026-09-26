import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Authentication & Session Management', () => {
  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  afterEach(async () => {
    await clearMemoryDB();
  });

  describe('User Registration (POST /api/auth/register)', () => {
    it('registers a new user with default role (participant)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'securePassword123'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.role).toBe('participant');
      expect(res.body.user.password).toBeUndefined(); // Never expose password in response
      expect(res.body.session).toBeDefined();
      expect(res.body.session.token).toBeDefined();
      expect(typeof res.body.session.token).toBe('string');
      expect(res.body.session.expiresAt).toBeDefined();

      // Verify DB persistence and password hashing
      const dbUser = await User.findOne({ email: 'alice@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.password).not.toBe('securePassword123');
      expect(dbUser.password.startsWith('$2')).toBe(true); // bcrypt hash prefix
    });

    it('registers a user with an explicit supported role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'judge.bob@example.com',
          password: 'securePassword123',
          role: 'judge'
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('judge');
    });

    it('rejects duplicate email registration with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'differentPassword123'
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error', 'Conflict');
    });

    it('rejects invalid email address format with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });

    it('rejects passwords shorter than 6 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'short@example.com',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });

    it('rejects unsupported role with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'badrole@example.com',
          password: 'password123',
          role: 'superadmin'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });
  });

  describe('User Login (POST /api/auth/login)', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login.user@example.com',
          password: 'mySecretPassword',
          role: 'organizer'
        });
    });

    it('logs in successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.user@example.com',
          password: 'mySecretPassword'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body.user.email).toBe('login.user@example.com');
      expect(res.body.user.role).toBe('organizer');
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.session.token).toBeDefined();

      // Verify session exists in DB
      const dbSession = await Session.findOne({ token: res.body.session.token });
      expect(dbSession).not.toBeNull();
      expect(dbSession.isValid).toBe(true);
    });

    it('rejects login with incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.user@example.com',
          password: 'wrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects login for non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'mySecretPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects missing credentials with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });
  });

  describe('Session Lookup & Validation (GET /api/auth/me)', () => {
    let sessionToken;
    let registeredUser;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'session.test@example.com',
          password: 'password123',
          role: 'admin'
        });
      sessionToken = regRes.body.session.token;
      registeredUser = regRes.body.user;
    });

    it('returns authenticated user via Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('session.test@example.com');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.session.token).toBe(sessionToken);
    });

    it('returns authenticated user via x-session-token header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('session.test@example.com');
    });

    it('rejects request without token with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects request with invalid/fake token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer fake-invalid-token-123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects expired session with 401', async () => {
      // Manually set session expiration in the past
      await Session.updateOne(
        { token: sessionToken },
        { $set: { expiresAt: new Date(Date.now() - 10000) } }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('Session Logout (POST /api/auth/logout)', () => {
    let sessionToken;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout.test@example.com',
          password: 'password123'
        });
      sessionToken = regRes.body.session.token;
    });

    it('invalidates active session upon logout', async () => {
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toContain('Logged out');

      // Subsequent lookup must now fail
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(meRes.status).toBe(401);
      expect(meRes.body.error).toBe('Unauthorized');

      // DB verification
      const dbSession = await Session.findOne({ token: sessionToken });
      expect(dbSession.isValid).toBe(false);
    });
  });
});
