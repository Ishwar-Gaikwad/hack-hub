import request from 'supertest';
import app from '../src/app.js';
import Team from '../src/models/team.model.js';
import Invitation from '../src/models/invitation.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('Team Formation & Invite Links (T1-04)', () => {
  let organizerToken;
  let adminToken;
  let participant1Token;
  let participant1Id;
  let participant2Token;
  let participant2Id;
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

    // Register test accounts
    const orgRes = await request(app).post('/api/auth/register').send({
      email: 'organizer@hackhub.local',
      password: 'password123',
      role: 'organizer'
    });
    organizerToken = orgRes.body.session.token;

    const admRes = await request(app).post('/api/auth/register').send({
      email: 'admin@hackhub.local',
      password: 'password123',
      role: 'admin'
    });
    adminToken = admRes.body.session.token;

    const p1Res = await request(app).post('/api/auth/register').send({
      email: 'alice.participant@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant1Token = p1Res.body.session.token;
    participant1Id = p1Res.body.user._id;

    const p2Res = await request(app).post('/api/auth/register').send({
      email: 'bob.participant@hackhub.local',
      password: 'password123',
      role: 'participant'
    });
    participant2Token = p2Res.body.session.token;
    participant2Id = p2Res.body.user._id;

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
        name: 'Team Hackathon 2026',
        startDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
        submissionDeadline: new Date('2026-10-03T18:00:00.000Z').toISOString(),
        endDate: new Date('2026-10-03T22:00:00.000Z').toISOString()
      });
    eventId = eventRes.body.event._id;
  });

  describe('Team Creation (POST /api/events/:eventId/teams)', () => {
    it('allows an authenticated participant to create a team and automatically becomes owner member', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ name: 'Quantum Coders' });

      expect(res.status).toBe(201);
      expect(res.body.team).toBeDefined();
      expect(res.body.team.name).toBe('Quantum Coders');
      expect(res.body.team.eventId.toString()).toBe(eventId);
      expect(res.body.team.creatorId.toString()).toBe(participant1Id);
      expect(Array.isArray(res.body.team.members)).toBe(true);
      expect(res.body.team.members.length).toBe(1);
      expect(res.body.team.members[0].userId._id.toString()).toBe(participant1Id);
      expect(res.body.team.members[0].role).toBe('owner');

      // Verify DB state
      const dbTeam = await Team.findById(res.body.team._id);
      expect(dbTeam).not.toBeNull();
      expect(dbTeam.members[0].userId.toString()).toBe(participant1Id);
    });

    it('rejects unauthenticated visitor from creating a team with 401', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .send({ name: 'Anonymous Team' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects judge from creating a team with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${judgeToken}`)
        .send({ name: 'Judge Team' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects organizer from creating a participant team with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ name: 'Organizer Team' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects admin from creating a participant team with 403', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Team' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('rejects team creation for non-existent event with 404', async () => {
      const fakeEventId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/api/events/${fakeEventId}/teams`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ name: 'Orphan Team' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('rejects team name shorter than 2 characters with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ name: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BadRequest');
    });
  });

  describe('Team Retrieval (GET /api/teams/:id & GET /api/teams/my-teams)', () => {
    let teamId;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ name: 'Byte Brawlers' });
      teamId = res.body.team._id;
    });

    it('retrieves team details and populated members', async () => {
      const res = await request(app).get(`/api/teams/${teamId}`);
      expect(res.status).toBe(200);
      expect(res.body.team.name).toBe('Byte Brawlers');
      expect(res.body.team.members.length).toBe(1);
      expect(res.body.team.members[0].userId.email).toBe('alice.participant@hackhub.local');
    });

    it('retrieves all teams for an event', async () => {
      const res = await request(app).get(`/api/events/${eventId}/teams`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.teams)).toBe(true);
      expect(res.body.teams.length).toBe(1);
    });

    it('retrieves current authenticated participant teams', async () => {
      const res = await request(app)
        .get('/api/teams/my-teams')
        .set('Authorization', `Bearer ${participant1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.teams)).toBe(true);
      expect(res.body.teams.length).toBe(1);
      expect(res.body.teams[0]._id.toString()).toBe(teamId);
    });
  });

  describe('Team Invitations & Joining (POST /api/teams/:id/invites & POST /api/teams/join)', () => {
    let teamId;
    let inviteToken;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/teams`)
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ name: 'Cyber Titans' });
      teamId = res.body.team._id;

      // Generate invite as team creator/member
      const inviteRes = await request(app)
        .post(`/api/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${participant1Token}`);
      inviteToken = inviteRes.body.invitation.token;
    });

    it('allows a team member to generate a secure invitation token', async () => {
      expect(inviteToken).toBeDefined();
      expect(typeof inviteToken).toBe('string');
      expect(inviteToken.length).toBeGreaterThanOrEqual(32); // Secure non-predictable token
    });

    it('rejects a non-member participant from generating an invite for a team with 403', async () => {
      const res = await request(app)
        .post(`/api/teams/${teamId}/invites`)
        .set('Authorization', `Bearer ${participant2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('allows another authenticated participant to join using the invite token', async () => {
      const joinRes = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({ token: inviteToken });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.team.members.length).toBe(2);

      // Verify both members are in the team
      const memberIds = joinRes.body.team.members.map(m => m.userId._id.toString());
      expect(memberIds).toContain(participant1Id);
      expect(memberIds).toContain(participant2Id);

      // Verify DB state
      const dbTeam = await Team.findById(teamId);
      expect(dbTeam.members.length).toBe(2);
    });

    it('allows inspecting invitation details before joining', async () => {
      const inspectRes = await request(app).get(`/api/invites/${inviteToken}`);
      expect(inspectRes.status).toBe(200);
      expect(inspectRes.body.invitation.team.name).toBe('Cyber Titans');
      expect(inspectRes.body.invitation.token).toBe(inviteToken);
    });

    it('rejects an invalid/fake invitation token with 404', async () => {
      const res = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({ token: 'fake-invalid-token-xyz' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('rejects joining when already a member with 409 Conflict', async () => {
      // Participant 1 is already creator/member
      const res = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${participant1Token}`)
        .send({ token: inviteToken });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Conflict');
    });

    it('rejects expired invitation tokens with 400', async () => {
      // Expire token in DB
      await Invitation.updateOne(
        { token: inviteToken },
        { $set: { expiresAt: new Date(Date.now() - 10000) } }
      );

      const res = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({ token: inviteToken });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('expired');
    });

    it('rejects judge from joining a team with 403', async () => {
      const res = await request(app)
        .post('/api/teams/join')
        .set('Authorization', `Bearer ${judgeToken}`)
        .send({ token: inviteToken });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request to join with 401', async () => {
      const res = await request(app)
        .post('/api/teams/join')
        .send({ token: inviteToken });

      expect(res.status).toBe(401);
    });
  });
});
