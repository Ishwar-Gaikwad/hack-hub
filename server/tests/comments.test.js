import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Comment from '../src/models/comment.model.js';
import AuditLog from '../src/models/audit.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('T3.7 & T3.8 Project Comments & Moderation Security', () => {
  let organizer, participant1, participant2, admin;
  let orgToken, part1Token, part2Token, adminToken;
  let event, track, team, project;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    organizer = await User.create({ email: 'org@example.com', password: 'password123', role: 'organizer' });
    admin = await User.create({ email: 'admin@example.com', password: 'password123', role: 'admin' });
    participant1 = await User.create({ email: 'p1@example.com', password: 'password123', role: 'participant' });
    participant2 = await User.create({ email: 'p2@example.com', password: 'password123', role: 'participant' });

    const expiresAt = new Date(Date.now() + 86400000);
    const sOrg = await Session.create({ userId: organizer._id, token: 'tok_org', expiresAt });
    const sAdmin = await Session.create({ userId: admin._id, token: 'tok_admin', expiresAt });
    const sP1 = await Session.create({ userId: participant1._id, token: 'tok_p1', expiresAt });
    const sP2 = await Session.create({ userId: participant2._id, token: 'tok_p2', expiresAt });

    orgToken = sOrg.token;
    adminToken = sAdmin.token;
    part1Token = sP1.token;
    part2Token = sP2.token;

    event = await Event.create({
      name: 'Hackathon 2026',
      startDate: new Date(Date.now() - 100000),
      submissionDeadline: new Date(Date.now() + 100000),
      endDate: new Date(Date.now() + 200000),
      status: 'published',
      createdBy: organizer._id
    });

    track = await Track.create({ eventId: event._id, name: 'Open Track' });
    team = await Team.create({ eventId: event._id, name: 'Team Alpha', creatorId: participant1._id });
    project = await Project.create({
      eventId: event._id,
      teamId: team._id,
      trackId: track._id,
      title: 'Decentralized Identity Protocol',
      description: 'Zero-knowledge proof identity',
      status: 'submitted'
    });
  });

  describe('Comment Creation & Validation', () => {
    it('allows an authenticated user to add a comment to a submitted project', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/projects/${project._id}/comments`)
        .set('Authorization', `Bearer ${part1Token}`)
        .send({ content: 'Impressive zero-knowledge implementation!' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('comment');
      expect(res.body.comment.content).toBe('Impressive zero-knowledge implementation!');
      expect(res.body.comment.author.email).toBe('p1@example.com');

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'comment.created', projectId: project._id });
      expect(audit).toBeTruthy();
    });

    it('rejects empty or whitespace-only comments with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/projects/${project._id}/comments`)
        .set('Authorization', `Bearer ${part1Token}`)
        .send({ content: '    ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('rejects comment exceeding 1000 characters with 400 Bad Request', async () => {
      const longContent = 'A'.repeat(1001);
      const res = await request(app)
        .post(`/api/events/${event._id}/projects/${project._id}/comments`)
        .set('Authorization', `Bearer ${part1Token}`)
        .send({ content: longContent });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('sanitizes HTML / script tags to prevent stored XSS attacks', async () => {
      const maliciousPayload = '<script>alert("xss")</script>Great project!';
      const res = await request(app)
        .post(`/api/events/${event._id}/projects/${project._id}/comments`)
        .set('Authorization', `Bearer ${part1Token}`)
        .send({ content: maliciousPayload });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).not.toContain('<script>');
      expect(res.body.comment.content).toContain('&lt;script&gt;');
    });

    it('rejects unauthenticated user from posting comments with 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/events/${event._id}/projects/${project._id}/comments`)
        .send({ content: 'Anonymous comment' });

      expect(res.status).toBe(401);
    });
  });

  describe('Comment Retrieval', () => {
    beforeEach(async () => {
      await Comment.create({
        eventId: event._id,
        projectId: project._id,
        authorId: participant1._id,
        content: 'First comment'
      });
      await Comment.create({
        eventId: event._id,
        projectId: project._id,
        authorId: participant2._id,
        content: 'Second comment'
      });
    });

    it('retrieves all comments for a project sorted in reverse chronological order', async () => {
      const res = await request(app)
        .get(`/api/events/${event._id}/projects/${project._id}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.comments).toHaveLength(2);
      expect(res.body.comments[0].author.email).toBeDefined();
    });
  });

  describe('Comment Deletion & Organizer Moderation', () => {
    let commentByP1;

    beforeEach(async () => {
      commentByP1 = await Comment.create({
        eventId: event._id,
        projectId: project._id,
        authorId: participant1._id,
        content: 'Original comment by participant 1'
      });
    });

    it('allows author to delete their own comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentByP1._id}`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comment deleted successfully');

      const check = await Comment.findById(commentByP1._id);
      expect(check).toBeNull();
    });

    it('rejects another participant from deleting author comment with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentByP1._id}`)
        .set('Authorization', `Bearer ${part2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');

      // Verify comment still exists
      const check = await Comment.findById(commentByP1._id);
      expect(check).not.toBeNull();
    });

    it('allows organizer to moderate and delete any comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentByP1._id}`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);

      const check = await Comment.findById(commentByP1._id);
      expect(check).toBeNull();

      // Verify audit log has moderation flag
      const audit = await AuditLog.findOne({ action: 'comment.deleted', 'metadata.moderated': true });
      expect(audit).toBeTruthy();
    });

    it('allows admin to moderate and delete any comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentByP1._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('returns 404 for deleting a non-existent comment', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/comments/${nonExistentId}`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(404);
    });
  });
});
