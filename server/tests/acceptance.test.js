import request from 'supertest';
import app from '../src/app.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';
import { seedDatabase } from '../src/db/seed.js';

describe('T1 Integration & DOGFOOD Acceptance Verification (T1-08)', () => {
  let seeded;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();
    seeded = await seedDatabase({ quiet: true });
  });

  describe('DOGFOOD Acceptance Checks: Public Gallery & Fixtures', () => {
    it('1. GET /api/projects without auth returns HTTP 200 and fixture project', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(res.body.projects).toBeDefined();
      expect(Array.isArray(res.body.projects)).toBe(true);

      const titles = res.body.projects.map((p) => p.title);
      expect(titles).toContain('HackHub Autonomous Workflow Orchestrator');
      expect(titles).toContain('Visionary Defect Inspector');

      // Verify draft is excluded
      expect(titles).not.toContain('Unpublished Experimental Idea');
      expect(titles).not.toContain('Unsubmitted Legacy Draft');
    });

    it('2. GET /health and /api/health return HTTP 200 healthy status', async () => {
      const res1 = await request(app).get('/health');
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('healthy');

      const res2 = await request(app).get('/api/health');
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('healthy');
    });

    it('3. Authenticates organizer, judge, and participant credentials from seed', async () => {
      // Organizer
      const orgRes = await request(app).post('/api/auth/login').send({
        email: 'organizer@hackhub.local',
        password: 'password123'
      });
      expect(orgRes.status).toBe(200);
      expect(orgRes.body.user.role).toBe('organizer');

      // Judge
      const jdgRes = await request(app).post('/api/auth/login').send({
        email: 'judge@hackhub.local',
        password: 'password123'
      });
      expect(jdgRes.status).toBe(200);
      expect(jdgRes.body.user.role).toBe('judge');

      // Participant
      const partRes = await request(app).post('/api/auth/login').send({
        email: 'alice@hackhub.local',
        password: 'password123'
      });
      expect(partRes.status).toBe(200);
      expect(partRes.body.user.role).toBe('participant');
    });
  });

  describe('Full T1 End-to-End Lifecycle Verification', () => {
    it('executes full organizer -> team -> draft -> edit -> submit -> gallery lifecycle', async () => {
      // 1. Organizer logs in
      const orgLogin = await request(app).post('/api/auth/login').send({
        email: 'organizer@hackhub.local',
        password: 'password123'
      });
      const orgToken = orgLogin.body.session.token;

      // 2. Organizer creates event
      const eventRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({
          name: 'End-to-End Grand Prix 2099',
          startDate: '2099-06-01T00:00:00.000Z',
          submissionDeadline: '2099-06-05T18:00:00.000Z',
          endDate: '2099-06-06T00:00:00.000Z'
        });
      expect(eventRes.status).toBe(201);
      const eventId = eventRes.body.event._id;


      // 3. Organizer creates track & prize
      const trackRes = await request(app)
        .post(`/api/events/${eventId}/tracks`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: 'E2E Track', description: 'Testing track' });
      expect(trackRes.status).toBe(201);
      const trackId = trackRes.body.track._id;

      const prizeRes = await request(app)
        .post(`/api/events/${eventId}/prizes`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ name: 'Top Performer', value: '$5,000' });
      expect(prizeRes.status).toBe(201);


      // 4. Participant 1 logs in and creates team
      const p1Login = await request(app).post('/api/auth/login').send({
        email: 'alice@hackhub.local',
        password: 'password123'
      });
      const p1Token = p1Login.body.session.token;

      const teamRes = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${p1Token}`)
        .send({ name: 'E2E Team' });
      expect(teamRes.status).toBe(201);
      const teamId = teamRes.body.team._id;

      // 5. Participant 1 invites Participant 2
      const inviteRes = await request(app)
        .post(`/api/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${p1Token}`);
      expect(inviteRes.status).toBe(201);
      const inviteToken = inviteRes.body.invitation.token;

      const p2Login = await request(app).post('/api/auth/login').send({
        email: 'bob@hackhub.local',
        password: 'password123'
      });
      const p2Token = p2Login.body.session.token;

      const joinRes = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${p2Token}`)
        .send({ token: inviteToken });
      expect(joinRes.status).toBe(200);

      // 6. Participant creates project draft
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${p1Token}`)
        .send({
          eventId,
          teamId,
          trackId,
          title: 'E2E Breakthrough Platform',
          description: 'Initial draft overview'
        });
      expect(projRes.status).toBe(201);
      expect(projRes.body.project.status).toBe('draft');
      const projectId = projRes.body.project._id;

      // 7. Verify project does NOT appear in public gallery yet
      const galBefore = await request(app).get('/api/projects');
      const titlesBefore = galBefore.body.projects.map((p) => p.title);
      expect(titlesBefore).not.toContain('E2E Breakthrough Platform');

      // 8. Teammate edits draft
      const editRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${p2Token}`)
        .send({
          title: 'E2E Breakthrough Platform Final',
          description: 'Polished complete description',
          repositoryUrl: 'https://github.com/e2e/breakthrough'
        });
      expect(editRes.status).toBe(200);
      expect(editRes.body.project.title).toBe('E2E Breakthrough Platform Final');

      // 9. Teammate explicitly submits project
      const submitRes = await request(app)
        .post(`/api/projects/${projectId}/submit`)
        .set('Authorization', `Bearer ${p2Token}`);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.project.status).toBe('submitted');

      // 10. Public visitor views gallery without auth -> project is now visible
      const galAfter = await request(app).get('/api/projects');
      expect(galAfter.status).toBe(200);
      const titlesAfter = galAfter.body.projects.map((p) => p.title);
      expect(titlesAfter).toContain('E2E Breakthrough Platform Final');

      // 11. Search and filter
      const searchRes = await request(app).get('/api/projects?q=Breakthrough');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.projects.length).toBe(1);
      expect(searchRes.body.projects[0].title).toBe('E2E Breakthrough Platform Final');

      const filterRes = await request(app).get(`/api/projects?eventId=${eventId}&trackId=${trackId}`);
      expect(filterRes.status).toBe(200);
      expect(filterRes.body.projects.length).toBe(1);
    });

    it('rejects submissions after deadline and preserves draft state', async () => {
      const expiredEvent = seeded.events.expiredEvent;
      const expiredDraft = seeded.projects.expiredDraftProject;

      const p1Login = await request(app).post('/api/auth/login').send({
        email: 'alice@hackhub.local',
        password: 'password123'
      });
      const token = p1Login.body.session.token;

      // Attempt to submit expired draft -> 400 DeadlineExceeded
      const res = await request(app)
        .post(`/api/projects/${expiredDraft._id}/submit`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DeadlineExceeded');

      // Verify draft state remains untouched
      const getRes = await request(app).get(`/api/projects/${expiredDraft._id}`);
      expect(getRes.body.project.status).toBe('draft');
    });
  });
});
