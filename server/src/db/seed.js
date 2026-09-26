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

export async function seedDatabase(options = {}) {
  const { quiet = false } = options;
  const log = (msg) => {
    if (!quiet) console.log(msg);
  };

  log('[Seed] Starting DOGFOOD 2026 database seeding...');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
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

  // 1. Seed Users
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

  log('[Seed] Seeded 6 users across all roles (organizer, admin, judge, participant).');

  // 2. Seed Active Event
  const activeEvent = await Event.create({
    name: 'DOGFOOD 2026 Global AI Hackathon',
    description: 'The premier benchmark hackathon event for autonomous agents and developer tooling.',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    submissionDeadline: new Date('2026-12-31T23:59:59.000Z'),
    endDate: new Date('2027-01-05T00:00:00.000Z'),
    status: 'published',
    createdBy: organizer._id
  });

  // 3. Seed Tracks
  const trackAgents = await Track.create({
    eventId: activeEvent._id,
    name: 'Autonomous Agents & Multi-Agent Systems',
    description: 'Create multi-agent collaborative workflows and self-healing systems.'
  });

  const trackTools = await Track.create({
    eventId: activeEvent._id,
    name: 'Developer Tooling & Infrastructure',
    description: 'Build fast, deterministic developer tooling and local infrastructure.'
  });

  const trackVision = await Track.create({
    eventId: activeEvent._id,
    name: 'Computer Vision & Multimodal AI',
    description: 'Deploy real-time computer vision and multimodal reasoning systems.'
  });

  log('[Seed] Seeded active event and 3 tracks.');

  // 4. Seed Prizes
  await Prize.create([
    {
      eventId: activeEvent._id,
      name: 'Grand Champion Prize',
      value: '$10,000 USD',
      description: 'Awarded to the most impactful overall project.'
    },
    {
      eventId: activeEvent._id,
      name: 'Best Agent Architecture',
      value: '$5,000 USD',
      description: 'Awarded to the project with the best multi-agent design.'
    }
  ]);

  log('[Seed] Seeded 2 prizes.');

  // 5. Seed Teams
  const teamPioneers = await Team.create({
    eventId: activeEvent._id,
    name: 'Agentic Pioneers',
    creatorId: alice._id,
    members: [
      { userId: alice._id, role: 'owner', joinedAt: new Date() },
      { userId: bob._id, role: 'member', joinedAt: new Date() }
    ]
  });

  const teamSolo = await Team.create({
    eventId: activeEvent._id,
    name: 'Solo Innovators',
    creatorId: carol._id,
    members: [
      { userId: carol._id, role: 'owner', joinedAt: new Date() }
    ]
  });

  log('[Seed] Seeded 2 teams with participant memberships.');

  // 6. Seed Projects
  const submittedProject1 = await Project.create({
    eventId: activeEvent._id,
    teamId: teamPioneers._id,
    trackId: trackAgents._id,
    title: 'HackHub Autonomous Workflow Orchestrator',
    description: 'Self-hosted autonomous agent workflow orchestration engine with multi-agent consensus and deterministic self-healing.',
    repositoryUrl: 'https://github.com/agentic-pioneers/hackhub-orchestrator',
    status: 'submitted'
  });

  const submittedProject2 = await Project.create({
    eventId: activeEvent._id,
    teamId: teamSolo._id,
    trackId: trackVision._id,
    title: 'Visionary Defect Inspector',
    description: 'High-speed edge computer vision defect inspector for automated manufacturing lines.',
    repositoryUrl: 'https://github.com/solo-innovators/defect-inspector',
    status: 'submitted'
  });

  log('[Seed] Seeded 2 submitted projects appearing in public gallery.');

  // 7. Seed Expired Event (for deadline tests)
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

  log('[Seed] Database seeding completed successfully.');


  return {
    users: { organizer, admin, judge, alice, bob, carol },
    events: { activeEvent, expiredEvent },
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
