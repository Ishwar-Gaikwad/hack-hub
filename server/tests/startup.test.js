import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/index.js';

describe('Application Foundation and Configuration', () => {
  it('provides valid default configuration properties', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
    expect(config.database.uri).toBeDefined();
    expect(config.env).toBeDefined();
  });

  it('handles unknown API routes with a clear 404 JSON response', async () => {
    const res = await request(app).get('/api/unknown-endpoint-test');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
    expect(res.body).toHaveProperty('message');
  });

  it('serves default JSON info on root route when client is not built', async () => {
    const res = await request(app).get('/');
    // When client is not built, root returns JSON info; when client is built, it returns 200 HTML
    expect([200, 304]).toContain(res.status);
  });
});
