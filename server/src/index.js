import app from './app.js';
import config from './config/index.js';
import { connectDB, disconnectDB } from './db/connection.js';

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
