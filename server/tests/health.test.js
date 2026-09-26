import request from 'supertest';
import app from '../src/app.js';
import { connectMemoryDB, closeMemoryDB } from './helpers/db-handler.js';
import mongoose from 'mongoose';

describe('Health Check Endpoints', () => {
  describe('When database is connected', () => {
    beforeAll(async () => {
      await connectMemoryDB();
    });

    afterAll(async () => {
      await closeMemoryDB();
    });

    it('GET /health returns 200 and healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('environment');
      expect(res.body.database).toBeDefined();
      expect(res.body.database.status).toBe('connected');
      expect(res.body.database.connected).toBe(true);
    });

    it('GET /api/health returns 200 and identical healthy payload', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database.connected).toBe(true);
    });
  });

  describe('When database is disconnected', () => {
    beforeAll(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    });

    it('GET /health returns 503 and unhealthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty('status', 'unhealthy');
      expect(res.body.database.connected).toBe(false);
      expect(res.body.database.status).toBe('disconnected');
    });

    it('GET /api/health returns 503 when disconnected', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
    });
  });
});
