import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import config from '../config/index.js';
import { connectDB, disconnectDB } from './connection.js';
import User from '../models/user.model.js';
import Session from '../models/session.model.js';
import Event from '../models/event.model.js';
import Track from '../models/track.model.js';
import Prize from '../models/prize.model.js';
import Team from '../models/team.model.js';
import Invitation from '../models/invitation.model.js';
import Project from '../models/project.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedDatabase(options = {}) {
  const { quiet = false } = options;
  const log = (msg) => {
    if (!quiet) console.log(msg);
  };

  log('[Seed] Starting DOGFOOD 2026 database seeding...');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // Load fixtures.json if available
  let fixturesData = null;
  const fixturePaths = [
    path.resolve(__dirname, '../../../fixtures.json'),
    path.resolve(__dirname, '../../fixtures.json'),
    path.resolve(process.cwd(), 'fixtures.json')
  ];

  for (const p of fixturePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        fixturesData = JSON.parse(raw);
        log(`[Seed] Loaded fixture data from ${p}`);
        break;
      } catch (err) {
        console.warn(`[Seed] Failed to parse ${p}: ${err.message}`);
      }
    }
  }

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Event.deleteMany({}),
    Track.deleteMany({}),
    Prize.deleteMany({}),
    Team.deleteMany({}),
    Invitation.deleteMany({}),
    Project.deleteMany({})
  ]);

  log('[Seed] Cleared existing data.');

  // 1. Seed Users (Standard test users and official DOGFOOD identities)
  const password = 'password123';

  const organizer = await User.create({
    email: 'organizer@hackhub.local',
    password,
    role: 'organizer'
  });

  const admin = await User.create({
    email: 'admin@hackhub.local',
    password,
    role: 'admin'
  });

  const judge = await User.create({
    email: 'judge@hackhub.local',
    password,
    role: 'judge'
  });

  const judgeA = await User.create({
    email: 'judge_a@hackhub.local',
    password,
    role: 'judge'
  });

  const judgeB = await User.create({
    email: 'judge_b@hackhub.local',
    password,
    role: 'judge'
  });

  const participant = await User.create({
    email: 'participant@hackhub.local',
    password,
    role: 'participant'
  });

  const alice = await User.create({
    email: 'alice@hackhub.local',
    password,
    role: 'participant'
  });

  const bob = await User.create({
    email: 'bob@hackhub.local',
    password,
    role: 'participant'
  });

  const carol = await User.create({
    email: 'carol@hackhub.local',
    password,
    role: 'participant'
  });

  log('[Seed] Seeded users including organizer, judge_a, judge_b, participant, admin.');

  // 2. Create Persistent Long-Lived Sessions for official checker
  const longExpiry = new Date('2099-01-01T00:00:00.000Z');
  await Session.create([
    { userId: organizer._id, token: 'dogfood-organizer-auth-token-2026', expiresAt: longExpiry, isValid: true },
    { userId: judgeA._id, token: 'dogfood-judge-a-auth-token-2026', expiresAt: longExpiry, isValid: true },
    { userId: judgeB._id, token: 'dogfood-judge-b-auth-token-2026', expiresAt: longExpiry, isValid: true },
    { userId: participant._id, token: 'dogfood-participant-auth-token-2026', expiresAt: longExpiry, isValid: true },
    { userId: alice._id, token: 'dogfood-alice-auth-token-2026', expiresAt: longExpiry, isValid: true }
  ]);

  // 3. Seed Closed Fixture Event (submissions_close = 2026-03-01T18:00:00Z in the past)
  const eventConfig = fixturesData?.event || {
    name: 'DOGFOOD 2026 Global AI Hackathon',
    description: 'The premier benchmark hackathon event for autonomous agents and developer tooling.',
    start_date: '2026-01-01T00:00:00.000Z',
    submissions_close: '2026-03-01T18:00:00Z',
    end_date: '2026-03-05T00:00:00.000Z',
    status: 'closed'
  };

  const closedFixtureEvent = await Event.create({
    name: eventConfig.name,
    description: eventConfig.description,
    startDate: new Date(eventConfig.start_date || '2026-01-01T00:00:00.000Z'),
    submissionDeadline: new Date(eventConfig.submissions_close || '2026-03-01T18:00:00.000Z'),
    endDate: new Date(eventConfig.end_date || '2026-03-05T00:00:00.000Z'),
    status: eventConfig.status || 'closed',
    createdBy: organizer._id
  });

  // 4. Seed Tracks
  const trackAgents = await Track.create({
    eventId: closedFixtureEvent._id,
    name: 'Autonomous Agents & Multi-Agent Systems',
    description: 'Create multi-agent collaborative workflows and self-healing systems.'
  });

  const trackTools = await Track.create({
    eventId: closedFixtureEvent._id,
    name: 'Developer Tooling & Infrastructure',
    description: 'Build fast, deterministic developer tooling and local infrastructure.'
  });

  const trackVision = await Track.create({
    eventId: closedFixtureEvent._id,
    name: 'Computer Vision & Multimodal AI',
    description: 'Deploy real-time computer vision and multimodal reasoning systems.'
  });

  log('[Seed] Seeded closed fixture event and tracks.');

  // 5. Seed Prizes
  await Prize.create([
    {
      eventId: closedFixtureEvent._id,
      name: 'Grand Champion Prize',
      value: '$10,000 USD',
      description: 'Awarded to the most impactful overall project.'
    },
    {
      eventId: closedFixtureEvent._id,
      name: 'Best Agent Architecture',
      value: '$5,000 USD',
      description: 'Awarded to the project with the best multi-agent design.'
    }
  ]);

  // 6. Seed Teams
  const teamPioneers = await Team.create({
    eventId: closedFixtureEvent._id,
    name: 'Agentic Pioneers',
    creatorId: alice._id,
    members: [
      { userId: alice._id, role: 'owner', joinedAt: new Date() },
      { userId: participant._id, role: 'member', joinedAt: new Date() },
      { userId: bob._id, role: 'member', joinedAt: new Date() }
    ]
  });

  const teamSolo = await Team.create({
    eventId: closedFixtureEvent._id,
    name: 'Solo Innovators',
    creatorId: carol._id,
    members: [
      { userId: carol._id, role: 'owner', joinedAt: new Date() }
    ]
  });

  // 7. Seed Fixture Projects (submitted status for public gallery)
  const submittedProject1 = await Project.create({
    eventId: closedFixtureEvent._id,
    teamId: teamPioneers._id,
    trackId: trackAgents._id,
    title: 'HackHub Autonomous Workflow Orchestrator',
    description: 'Self-hosted autonomous agent workflow orchestration engine with multi-agent consensus and deterministic self-healing.',
    repositoryUrl: 'https://github.com/agentic-pioneers/hackhub-orchestrator',
    status: 'submitted'
  });

  const submittedProject2 = await Project.create({
    eventId: closedFixtureEvent._id,
    teamId: teamSolo._id,
    trackId: trackVision._id,
    title: 'Visionary Defect Inspector',
    description: 'High-speed edge computer vision defect inspector for automated manufacturing lines.',
    repositoryUrl: 'https://github.com/solo-innovators/defect-inspector',
    status: 'submitted'
  });

  log('[Seed] Seeded submitted projects from fixtures appearing in public gallery.');

  // 8. Seed Expired Event (for deadline tests)
  const expiredEvent = await Event.create({
    name: 'DOGFOOD 2025 Retrospective Hackathon',
    description: 'Archived hackathon with closed submission window.',
    startDate: new Date('2025-01-01T00:00:00.000Z'),
    submissionDeadline: new Date('2025-01-10T00:00:00.000Z'),
    endDate: new Date('2025-01-15T00:00:00.000Z'),
    status: 'ended',
    createdBy: organizer._id
  });

  const expiredTrack = await Track.create({
    eventId: expiredEvent._id,
    name: 'Legacy Track',
    description: 'Closed track'
  });

  const expiredTeam = await Team.create({
    eventId: expiredEvent._id,
    name: 'Legacy Team',
    creatorId: alice._id,
    members: [
      { userId: alice._id, role: 'owner', joinedAt: new Date() }
    ]
  });

  const expiredDraftProject = await Project.create({
    eventId: expiredEvent._id,
    teamId: expiredTeam._id,
    trackId: expiredTrack._id,
    title: 'Unsubmitted Legacy Draft',
    description: 'Unsubmitted draft from closed event.',
    status: 'draft'
  });

  // Print official auth headers for evaluator
  log('============================================================');
  log(' [DOGFOOD 2026 Auth Headers]');
  log(' organizer   = Bearer dogfood-organizer-auth-token-2026');
  log(' judge_a     = Bearer dogfood-judge-a-auth-token-2026');
  log(' judge_b     = Bearer dogfood-judge-b-auth-token-2026');
  log(' participant = Bearer dogfood-participant-auth-token-2026');
  log('============================================================');

  return {
    users: { organizer, admin, judge, judgeA, judgeB, participant, alice, bob, carol },
    events: { activeEvent: closedFixtureEvent, closedFixtureEvent, expiredEvent },
    tracks: { trackAgents, trackTools, trackVision, expiredTrack },
    teams: { teamPioneers, teamSolo, expiredTeam },
    projects: { submittedProject1, submittedProject2, expiredDraftProject }
  };
}

// Run directly if called as main script
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(async () => {
      console.log('[Seed] All fixtures ready.');
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Seeding failed:', err);
      await disconnectDB();
      process.exit(1);
    });
}

export default seedDatabase;
