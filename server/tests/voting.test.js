import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Session from '../src/models/session.model.js';
import Event from '../src/models/event.model.js';
import Track from '../src/models/track.model.js';
import Team from '../src/models/team.model.js';
import Project from '../src/models/project.model.js';
import Vote from '../src/models/vote.model.js';
import AuditLog from '../src/models/audit.model.js';
import { connectMemoryDB, closeMemoryDB, clearMemoryDB } from './helpers/db-handler.js';

describe('T3 Community Voting & Ballot System', () => {
  let organizer, participant1, participant2, judge;
  let orgToken, part1Token, part2Token, judgeToken;
  let activeEvent, pastVotingEvent, futureVotingEvent;
  let track, team1, team2, project1, project2, draftProject;

  beforeAll(async () => {
    await connectMemoryDB();
  });

  afterAll(async () => {
    await closeMemoryDB();
  });

  beforeEach(async () => {
    await clearMemoryDB();

    // Create test users
    organizer = await User.create({ email: 'org@example.com', password: 'password123', role: 'organizer' });
    participant1 = await User.create({ email: 'voter1@example.com', password: 'password123', role: 'participant' });
    participant2 = await User.create({ email: 'voter2@example.com', password: 'password123', role: 'participant' });
    judge = await User.create({ email: 'judge@example.com', password: 'password123', role: 'judge' });

    // Create sessions
    const expiresAt = new Date(Date.now() + 86400000);
    const sOrg = await Session.create({ userId: organizer._id, token: 'tok_org', expiresAt });
    const sPart1 = await Session.create({ userId: participant1._id, token: 'tok_part1', expiresAt });
    const sPart2 = await Session.create({ userId: participant2._id, token: 'tok_part2', expiresAt });
    const sJudge = await Session.create({ userId: judge._id, token: 'tok_judge', expiresAt });

    orgToken = sOrg.token;
    part1Token = sPart1.token;
    part2Token = sPart2.token;
    judgeToken = sJudge.token;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    const pastWeek = new Date(now.getTime() - 7 * 86400000);

    // Active voting event
    activeEvent = await Event.create({
      name: 'Active Hackathon',
      startDate: pastWeek,
      submissionDeadline: tomorrow,
      endDate: nextWeek,
      status: 'published',
      createdBy: organizer._id,
      votingOpenAt: yesterday,
      votingCloseAt: tomorrow
    });

    // Event where voting hasn't started yet
    futureVotingEvent = await Event.create({
      name: 'Future Voting Hackathon',
      startDate: yesterday,
      submissionDeadline: tomorrow,
      endDate: nextWeek,
      status: 'published',
      createdBy: organizer._id,
      votingOpenAt: tomorrow,
      votingCloseAt: nextWeek
    });

    // Event where voting has ended
    pastVotingEvent = await Event.create({
      name: 'Past Voting Hackathon',
      startDate: pastWeek,
      submissionDeadline: pastWeek,
      endDate: yesterday,
      status: 'published',
      createdBy: organizer._id,
      votingOpenAt: pastWeek,
      votingCloseAt: yesterday
    });

    // Track and Teams
    track = await Track.create({ eventId: activeEvent._id, name: 'AI Track' });
    team1 = await Team.create({
      eventId: activeEvent._id,
      name: 'Alpha Team',
      creatorId: participant1._id,
      members: [{ userId: participant1._id, role: 'owner' }]
    });
    team2 = await Team.create({
      eventId: activeEvent._id,
      name: 'Beta Team',
      creatorId: participant2._id,
      members: [{ userId: participant2._id, role: 'owner' }]
    });

    // Submitted projects
    project1 = await Project.create({
      eventId: activeEvent._id,
      teamId: team1._id,
      trackId: track._id,
      title: 'Autonomous Drone Swarm',
      description: 'AI-guided autonomous swarm technology',
      status: 'submitted'
    });

    project2 = await Project.create({
      eventId: activeEvent._id,
      teamId: team2._id,
      trackId: track._id,
      title: 'Neural Synthesizer',
      description: 'Synthesizing neural signals for accessibility',
      status: 'submitted'
    });

    // Draft project (should not be votable)
    draftProject = await Project.create({
      eventId: activeEvent._id,
      teamId: team1._id,
      trackId: track._id,
      title: 'Work In Progress Drone',
      status: 'draft'
    });
  });

  describe('T3.1 & T3.2 Community Voting Window & Authentication', () => {
    it('successfully casts a vote within active voting window', async () => {
      const res = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'Vote recorded successfully');
      expect(res.body.projectId).toBe(project1._id.toString());

      // Verify in DB
      const vote = await Vote.findOne({ eventId: activeEvent._id, projectId: project1._id, voterId: participant1._id });
      expect(vote).toBeTruthy();

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'vote.created', projectId: project1._id });
      expect(audit).toBeTruthy();
    });

    it('rejects unauthenticated vote attempt with 401', async () => {
      const res = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects voting before voting opens (future voting window)', async () => {
      // Create project in future event
      const trackF = await Track.create({ eventId: futureVotingEvent._id, name: 'Web' });
      const teamF = await Team.create({ eventId: futureVotingEvent._id, name: 'Team F', creatorId: participant1._id });
      const projF = await Project.create({
        eventId: futureVotingEvent._id,
        teamId: teamF._id,
        trackId: trackF._id,
        title: 'Future Project',
        status: 'submitted'
      });

      const res = await request(app)
        .post(`/api/events/${futureVotingEvent._id}/projects/${projF._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VotingNotAllowed');
      expect(res.body.status).toBe('not_started');

      // Verify audit log rejected
      const audit = await AuditLog.findOne({ action: 'vote.rejected', eventId: futureVotingEvent._id });
      expect(audit).toBeTruthy();
    });

    it('rejects voting after voting closes (past voting window)', async () => {
      const trackP = await Track.create({ eventId: pastVotingEvent._id, name: 'Mobile' });
      const teamP = await Team.create({ eventId: pastVotingEvent._id, name: 'Team P', creatorId: participant1._id });
      const projP = await Project.create({
        eventId: pastVotingEvent._id,
        teamId: teamP._id,
        trackId: trackP._id,
        title: 'Past Project',
        status: 'submitted'
      });

      const res = await request(app)
        .post(`/api/events/${pastVotingEvent._id}/projects/${projP._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VotingNotAllowed');
      expect(res.body.status).toBe('ended');
    });

    it('rejects vote on a draft project with 400', async () => {
      const res = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${draftProject._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidProjectStatus');
    });

    it('rejects vote when project does not belong to specified event with 400', async () => {
      const anotherActiveEvent = await Event.create({
        name: 'Another Active Hackathon',
        startDate: new Date(Date.now() - 10000),
        submissionDeadline: new Date(Date.now() + 100000),
        endDate: new Date(Date.now() + 200000),
        status: 'published',
        createdBy: organizer._id,
        votingOpenAt: new Date(Date.now() - 10000),
        votingCloseAt: new Date(Date.now() + 100000)
      });

      const res = await request(app)
        .post(`/api/events/${anotherActiveEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EventMismatch');
    });
  });

  describe('T3.3 & T3.10 Duplicate-Vote Detection & Uniqueness Constraint', () => {
    it('prevents a voter from casting duplicate votes for the same project with 409 Conflict', async () => {
      // First vote
      const res1 = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);
      expect(res1.status).toBe(201);

      // Attempt duplicate vote
      const res2 = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);
      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('DuplicateVote');

      // Verify audit log has duplicate_vote.attempted
      const audit = await AuditLog.findOne({ action: 'duplicate_vote.attempted', actorId: participant1._id });
      expect(audit).toBeTruthy();

      // Ensure total votes in DB is still 1
      const count = await Vote.countDocuments({ eventId: activeEvent._id, projectId: project1._id });
      expect(count).toBe(1);
    });

    it('allows a voter to vote for different projects in the same event', async () => {
      const res1 = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project2._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);
      expect(res2.status).toBe(201);

      const userVotes = await Vote.find({ eventId: activeEvent._id, voterId: participant1._id });
      expect(userVotes.length).toBe(2);
    });

    it('allows a voter to retract a vote while voting is open', async () => {
      await request(app)
        .post(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      const retractRes = await request(app)
        .delete(`/api/events/${activeEvent._id}/projects/${project1._id}/vote`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(retractRes.status).toBe(200);
      expect(retractRes.body.message).toBe('Vote retracted successfully');

      const voteCheck = await Vote.findOne({ eventId: activeEvent._id, projectId: project1._id, voterId: participant1._id });
      expect(voteCheck).toBeNull();
    });
  });

  describe('T3.5 Server-Side Privacy: Live Vote Totals Hidden', () => {
    beforeEach(async () => {
      // Cast votes
      await Vote.create({ eventId: activeEvent._id, projectId: project1._id, voterId: participant1._id });
      await Vote.create({ eventId: activeEvent._id, projectId: project1._id, voterId: participant2._id });
      await Vote.create({ eventId: activeEvent._id, projectId: project2._id, voterId: participant1._id });
    });

    it('hides live vote totals and rankings from public visitor during active voting window', async () => {
      const res = await request(app)
        .get(`/api/events/${activeEvent._id}/results`);

      expect(res.status).toBe(200);
      expect(res.body.resultsHidden).toBe(true);
      expect(res.body.status).toBe('voting_in_progress');
      expect(res.body.results).toBeUndefined();
      expect(res.body.totalVotes).toBeUndefined();
    });

    it('hides live vote totals and rankings from participant during active voting window', async () => {
      const res = await request(app)
        .get(`/api/events/${activeEvent._id}/results`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.resultsHidden).toBe(true);
      expect(res.body.results).toBeUndefined();
    });

    it('allows organizer to inspect live metrics and rankings during active voting window', async () => {
      const res = await request(app)
        .get(`/api/events/${activeEvent._id}/results`)
        .set('Authorization', `Bearer ${orgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isStaffView).toBe(true);
      expect(res.body.totalVotes).toBe(3);
      expect(res.body.results).toBeDefined();
      expect(res.body.results.length).toBe(2);
      expect(res.body.results[0].projectId).toBe(project1._id.toString());
      expect(res.body.results[0].votes).toBe(2);
      expect(res.body.results[0].rank).toBe(1);
    });

    it('exposes final public results to everyone after voting window closes', async () => {
      // Close voting window
      activeEvent.votingCloseAt = new Date(Date.now() - 1000);
      await activeEvent.save();

      const publicRes = await request(app)
        .get(`/api/events/${activeEvent._id}/results`);

      expect(publicRes.status).toBe(200);
      expect(publicRes.body.status).toBe('published');
      expect(publicRes.body.resultsHidden).toBeUndefined();
      expect(publicRes.body.totalVotes).toBe(3);
      expect(publicRes.body.results).toHaveLength(2);
      expect(publicRes.body.results[0].votes).toBe(2);
      expect(publicRes.body.results[1].votes).toBe(1);
    });
  });

  describe('T3.6 Randomized Ballot Ordering', () => {
    it('returns submitted projects in a deterministic shuffle for the same voter across requests', async () => {
      const res1 = await request(app)
        .get(`/api/events/${activeEvent._id}/ballot`)
        .set('Authorization', `Bearer ${part1Token}`);

      const res2 = await request(app)
        .get(`/api/events/${activeEvent._id}/ballot`)
        .set('Authorization', `Bearer ${part1Token}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.ballotOrder).toHaveLength(2);

      const order1 = res1.body.ballotOrder.map(p => p._id);
      const order2 = res2.body.ballotOrder.map(p => p._id);
      expect(order1).toEqual(order2);
    });

    it('does not include draft projects on the community ballot', async () => {
      const res = await request(app)
        .get(`/api/events/${activeEvent._id}/ballot`);

      expect(res.status).toBe(200);
      const ids = res.body.ballotOrder.map(p => p._id);
      expect(ids).not.toContain(draftProject._id.toString());
    });
  });

  describe('T3.1 Organizer Voting Window Configuration', () => {
    it('allows organizer to update voting window dates', async () => {
      const newOpen = new Date().toISOString();
      const newClose = new Date(Date.now() + 1000000).toISOString();

      const res = await request(app)
        .put(`/api/events/${activeEvent._id}/voting`)
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ votingOpenAt: newOpen, votingCloseAt: newClose });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Voting window configured successfully');

      const updated = await Event.findById(activeEvent._id);
      expect(new Date(updated.votingOpenAt).toISOString()).toBe(new Date(newOpen).toISOString());
    });

    it('rejects participant from updating voting window with 403', async () => {
      const res = await request(app)
        .put(`/api/events/${activeEvent._id}/voting`)
        .set('Authorization', `Bearer ${part1Token}`)
        .send({ votingOpenAt: new Date() });

      expect(res.status).toBe(403);
    });
  });
});
