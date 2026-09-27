import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Score from '../src/models/score.model.js';
import Vote from '../src/models/vote.model.js';
import Webhook from '../src/models/webhook.model.js';
import { signPayload, dispatchWebhook } from '../src/services/webhook.service.js';
import { signManifest } from '../src/controllers/record.controller.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('T4 Stretch Architecture: REST API, Webhooks, Verifiable Records, Embed, Bulk Import/Export', () => {
  let organizer, admin, judge, participant;
  let orgToken, adminToken, judgeToken, partToken;
  let event, track, team, project;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    organizer = await User.create({ email: 'org@hackhub.local', password: 'password123', role: 'organizer' });
    admin = await User.create({ email: 'admin@hackhub.local', password: 'password123', role: 'admin' });
    judge = await User.create({ email: 'judge@hackhub.local', password: 'password123', role: 'judge' });
    participant = await User.create({ email: 'part@hackhub.local', password: 'password123', role: 'participant' });

    const expiresAt = new Date(Date.now() + 86400000);
    const sOrg = await Session.create({ userId: organizer._id, token: 'tok_org', expiresAt });
    const sAdm = await Session.create({ userId: admin._id, token: 'tok_adm', expiresAt });
    const sJdg = await Session.create({ userId: judge._id, token: 'tok_jdg', expiresAt });
    const sPrt = await Session.create({ userId: participant._id, token: 'tok_prt', expiresAt });

    orgToken = sOrg.token;
    adminToken = sAdm.token;
    judgeToken = sJdg.token;
    partToken = sPrt.token;

    event = await Event.create({
      name: 'Global Autonomous Hackathon 2026',
      startDate: new Date(Date.now() - 50000),
      submissionDeadline: new Date(Date.now() + 50000),
      endDate: new Date(Date.now() + 100000),
      status: 'published',
      createdBy: organizer._id
    });

    track = await Track.create({ eventId: event._id, name: 'AI Infrastructure' });
    team = await Team.create({
      eventId: event._id,
      name: 'DeepMind Pioneers',
      creatorId: participant._id,
      members: [{ userId: participant._id, role: 'owner' }]
    });

    project = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: track._id,
      title: 'HyperScale Agent Swarm',
      description: 'Distributed multi-agent workflow orchestration',
      repositoryUrl: 'https://github.com/deepmind/hyperscale-agents',
      status: 'submitted'
    });
  });

  describe('T4.1 & T4.3 REST API & OpenAPI 3.0 Documentation', () => {
    it('returns valid OpenAPI 3.0 specification from /api/openapi.json', async () => {
      const res = await request(app).get('/api/openapi.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('HackHub');
      expect(res.body.paths).toHaveProperty('/projects');
      expect(res.body.paths).toHaveProperty('/api/events/{eventId}/records/judging');
      expect(res.body.components.securitySchemes).toHaveProperty('BearerAuth');
    });

    it('renders offline-ready interactive API documentation HTML from /api/docs', async () => {
      const res = await request(app).get('/api/docs');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('HackHub DOGFOOD 2026 REST API');
      expect(res.text).toContain('/api/openapi.json');
    });
  });

  describe('T4.4, T4.5 & T4.6 Event Webhooks & Cryptographic Signing', () => {
    it('allows organizer to register a new webhook with custom secret', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/webhooks`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          targetUrl: 'https://webhook.example.org/events',
          secret: 'super-secure-secret-key-1234',
          subscribedEvents: ['submission.created', 'judging.completed']
        });

      expect(res.status).toBe(201);
      expect(res.body.webhook.targetUrl).toBe('https://webhook.example.org/events');
      expect(res.body.webhook.secret).toBe('super-secure-secret-key-1234');
      expect(res.body.webhook.subscribedEvents).toContain('submission.created');
    });

    it('rejects participant from creating a webhook with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/webhooks`)
        .set('Authorization', `Bearer ${partToken}`)
        .send({ targetUrl: 'https://test.org' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid webhook URL without http:// or https:// with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/webhooks`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ targetUrl: 'ftp://invalid-url.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('computes authentic HMAC-SHA256 signatures for webhook payloads', () => {
      const payload = { event: 'submission.created', id: '123' };
      const secret = 'my-test-secret';
      const sig1 = signPayload(payload, secret);
      const sig2 = signPayload(payload, secret);

      expect(sig1).toBe(sig2);
      expect(sig1.startsWith('sha256=')).toBe(true);
      expect(sig1).toHaveLength(7 + 64);
    });

    it('records delivery logs and manages webhook deletion', async () => {
      const hook = await Webhook.create({
        eventId: event._id,
        targetUrl: 'http://127.0.0.1:9999/dummy-endpoint',
        secret: 'test-secret-key-1234',
        subscribedEvents: ['*'],
        active: true
      });

      const listRes = await request(app)
        .get(`/api/events/${event._id}/webhooks`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);

      const delRes = await request(app)
        .delete(`/api/events/${event._id}/webhooks/${hook._id}`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(delRes.status).toBe(200);

      const check = await Webhook.findById(hook._id);
      expect(check).toBeNull();
    });
  });

  describe('T4.7 Verifiable Certificates & Records', () => {
    it('generates an authentic participation certificate with cryptographic verification hash', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/certificates/participation/${participant._id}`);

      expect(res.status).toBe(200);
      expect(res.body.achievement.type).toBe('participation');
      expect(res.body.achievement.projectTitle).toBe('HyperScale Agent Swarm');
      expect(res.body.recipient.email).toBe('part@hackhub.local');
      expect(res.body.verification).toHaveProperty('hash');
      expect(res.body.verification.algorithm).toBe('sha256');
    });

    it('generates printable HTML certificate when format=html is requested', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/certificates/participation/${participant._id}?format=html`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Certificate of Hackathon Participation');
      expect(res.text).toContain('HyperScale Agent Swarm');
      expect(res.text).toContain('part@hackhub.local');
    });

    it('rejects certificate request for a user who did not submit a project in the event with 400', async () => {
      const outsider = await User.create({ email: 'outsider@test.com', password: 'password123', role: 'participant' });

      const res = await request(app)
        .get(`/api/events/${event._id}/certificates/participation/${outsider._id}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CertificateIneligible');
    });

    it('generates judging excellence certificate for judge who completed evaluations', async () => {
      await Score.create({
        judgeId: judge._id,
        projectId: project._id,
        eventId: event._id,
        criteria: { functionality: 5, quality: 5, innovation: 5 },
        rawTotal: 15,
        normalizedScore: 100
      });

      const res = await request(app)
        .get(`/api/events/${event._id}/certificates/judge/${judge._id}`);

      expect(res.status).toBe(200);
      expect(res.body.achievement.type).toBe('judge');
      expect(res.body.achievement.evaluationsCompleted).toBe(1);
    });
  });

  describe('T4.8 Verifiable Judging Records', () => {
    beforeEach(async () => {
      await Score.create({
        judgeId: judge._id,
        projectId: project._id,
        eventId: event._id,
        criteria: { functionality: 5, quality: 4, innovation: 5 },
        rawTotal: 14,
        normalizedScore: 93.3
      });
    });

    it('generates a cryptographically signed judging manifest with anonymized judge pseudonyms', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/records/judging`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('verifiableRecord');
      expect(res.body).toHaveProperty('signature');
      expect(res.body.verifiableRecord.results).toHaveLength(1);

      // Verify judge identity was anonymized
      const evalItem = res.body.verifiableRecord.results[0].evaluations[0];
      expect(evalItem.judgePseudonym).toMatch(/^JDG-[A-F0-9]{8}$/);
      expect(evalItem.judgePseudonym).not.toContain('judge@hackhub.local');
    });

    it('verifies authenticity and integrity of a genuine judging record', async () => {
      const recordRes = await request(app)
        .get(`/api/events/${event._id}/records/judging`);

      const verifyRes = await request(app)
        .post(`/api/events/${event._id}/records/verify`)
        .send({
          manifest: recordRes.body.verifiableRecord,
          signature: recordRes.body.signature
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verified).toBe(true);
      expect(verifyRes.body.message).toContain('verified successfully');
    });

    it('detects and rejects tampered judging manifests with failed verification', async () => {
      const recordRes = await request(app)
        .get(`/api/events/${event._id}/records/judging`);

      // Tamper with average score in manifest
      const tamperedManifest = JSON.parse(JSON.stringify(recordRes.body.verifiableRecord));
      tamperedManifest.results[0].averageScore = 100;

      const verifyRes = await request(app)
        .post(`/api/events/${event._id}/records/verify`)
        .send({
          manifest: tamperedManifest,
          signature: recordRes.body.signature
        });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.verified).toBe(false);
      expect(verifyRes.body.message).toContain('failed');
    });
  });

  describe('T4.9 Embeddable Gallery', () => {
    it('serves standalone HTML gallery without external dependencies and with open CORS', async () => {
      const res = await request(app)
        .get(`/embed/gallery/${event._id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.text).toContain('HyperScale Agent Swarm');
      expect(res.text).toContain('DeepMind Pioneers');
      expect(res.text).toContain('AI Infrastructure');
    });

    it('serves open CORS JSON API for external embedding widgets', async () => {
      const res = await request(app)
        .get(`/api/embed/gallery/${event._id}`);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.body.count).toBe(1);
      expect(res.body.projects[0].title).toBe('HyperScale Agent Swarm');
      // Privileged fields like passwords or judge scores must NOT be present
      expect(res.body.projects[0].scores).toBeUndefined();
      expect(res.body.projects[0].passwordHash).toBeUndefined();
    });
  });

  describe('T4.10 Transactional Bulk Import & Export', () => {
    it('transactionally imports teams and projects when valid', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/import`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          teams: [
            { name: 'Quantum Leap Labs' },
            { name: 'CyberShield Collective' }
          ],
          projects: [
            { title: 'Quantum Qubit Simulator', teamName: 'Quantum Leap Labs', status: 'submitted' },
            { title: 'Zero Trust Guard', teamName: 'CyberShield Collective', status: 'submitted' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.importedTeamsCount).toBe(2);
      expect(res.body.importedProjectsCount).toBe(2);

      // Verify in DB
      const pCount = await Project.countDocuments({ eventId: event._id });
      expect(pCount).toBe(3); // 1 previous + 2 imported
    });

    it('rejects entire bulk import if any item fails validation, leaving DB untouched', async () => {
      const initialCount = await Project.countDocuments({ eventId: event._id });

      const res = await request(app)
        .post(`/api/events/${event._id}/import`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          teams: [{ name: 'Good Team' }],
          projects: [
            { title: 'Good Project' },
            { title: '' } // Invalid empty title!
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ImportValidationError');
      expect(res.body.errors).toBeDefined();

      // Database must not have been partially written
      const currentCount = await Project.countDocuments({ eventId: event._id });
      expect(currentCount).toBe(initialCount);
    });

    it('exports full event JSON archive (T4.10)', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/export/full`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.event.name).toBe('Global Autonomous Hackathon 2026');
      expect(res.body.tracks).toHaveLength(1);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.statistics.submittedProjects).toBe(1);
    });

    it('exports projects CSV with valid comma separation (T4.10)', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/export/csv?type=projects`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.split('\n');
      expect(lines[0]).toContain('Project ID,Title,Team,Track,Status');
      expect(lines[1]).toContain('HyperScale Agent Swarm');
    });
  });
});
