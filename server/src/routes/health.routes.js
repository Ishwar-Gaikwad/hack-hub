import { Router } from 'express';
import config from '../config/index.js';
import { getDBStatus } from '../db/connection.js';

const router = Router();

/**
 * Health check handler
 * Verifies application process and database connectivity
 */
export function healthHandler(req, res) {
  const dbStatus = getDBStatus();
  const isHealthy = dbStatus.connected;

  const healthData = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.env,
    database: {
      status: dbStatus.state,
      connected: dbStatus.connected,
      ...(dbStatus.name ? { name: dbStatus.name } : {}),
      ...(dbStatus.host ? { host: dbStatus.host } : {})
    }
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(healthData);
}

// Support both /health and /api/health
router.get('/', healthHandler);

export default router;
