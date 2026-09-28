import app from './app.js';
import config from './config/index.js';
import { connectDB, disconnectDB } from './db/connection.js';
import User from './models/user.model.js';
import { seedDatabase } from './db/seed.js';

let server;

async function startServer() {
  try {
    console.log(`[Server] Starting HackHub application in ${config.env} mode...`);
    
    // Connect to database
    try {
      await connectDB();
    } catch (dbError) {
      console.error(`[Server] FATAL: Database connection failed during startup.`);
      console.error(`[Server] Ensure MongoDB is running and reachable at ${config.database.uri}`);
      console.error(`[Server] Error details: ${dbError.message}`);
      process.exit(1);
    }

    // Auto-seed if database is empty or missing official fixtures to guarantee a seeded portal on docker compose up
    try {
      const Project = (await import('./models/project.model.js')).default;
      const fixtureProject = await Project.findOne({ title: 'Glass Signal' });
      if (!fixtureProject) {
        console.log('[Server] Official fixtures not found in database. Seeding official fixtures...');
        await seedDatabase();
      }
    } catch (seedErr) {
      console.warn('[Server] Auto-seed check warning:', seedErr.message);
    }

    // Start HTTP server
    server = app.listen(config.port, () => {
      console.log(`[Server] HackHub server running on port ${config.port}`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });

  } catch (error) {
    console.error(`[Server] Unhandled startup error:`, error);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed');
      try {
        await disconnectDB();
        console.log('[Server] Database connection closed cleanly');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error closing database connection:', err);
        process.exit(1);
      }
    });

    // Force close after 10s if shutdown hangs
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

// Start the server if this file is executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default startServer;
