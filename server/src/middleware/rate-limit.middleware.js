import AuditLog from '../models/audit.model.js';

/**
 * In-memory sliding window rate limiter
 * Stores timestamp arrays per key. Prunes old entries automatically.
 */
export class MemoryRateLimiter {
  constructor(windowMs = 60000, maxRequests = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();
  }

  isLimited(key) {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.hits.get(key) || [];
    timestamps = timestamps.filter(ts => ts > cutoff);

    if (timestamps.length >= this.maxRequests) {
      this.hits.set(key, timestamps);
      return { limited: true, count: timestamps.length, retryAfter: Math.ceil((timestamps[0] + this.windowMs - now) / 1000) };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { limited: false, count: timestamps.length };
  }

  reset() {
    this.hits.clear();
  }
}

/**
 * Express middleware generator for rate limiting
 * @param {Object} options
 * @param {number} options.windowMs Window size in milliseconds (default: 1 min)
 * @param {number} options.max Maximum requests permitted in window
 * @param {string} options.endpointName Identifying label for logs and audit trail
 */
export function rateLimit({ windowMs = 60000, max = 30, endpointName = 'generic' } = {}) {
  const limiter = new MemoryRateLimiter(windowMs, max);

  return async (req, res, next) => {
    // Generate key based on authenticated user ID or client IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
    const actorKey = req.user?._id ? `user:${req.user._id}` : `ip:${clientIp}`;
    const rateKey = `${endpointName}:${actorKey}`;

    const { limited, count, retryAfter } = limiter.isLimited(rateKey);

    if (limited) {
      // Record rate limit trigger to audit log asynchronously
      try {
        await AuditLog.create({
          action: 'rate_limit.triggered',
          actorId: req.user?._id || null,
          eventId: req.params?.eventId || null,
          projectId: req.params?.projectId || null,
          metadata: {
            endpoint: endpointName,
            key: rateKey,
            requestCount: count,
            limit: max,
            windowMs
          },
          ip: String(clientIp)
        });
      } catch (err) {
        // Silently continue if audit log fails
      }

      res.setHeader('Retry-After', retryAfter || 60);
      return res.status(429).json({
        error: 'TooManyRequests',
        message: `Too many requests for ${endpointName}. Please wait and try again later.`,
        retryAfter: retryAfter || 60
      });
    }

    next();
  };
}

// Pre-configured limiters
export const voteRateLimiter = rateLimit({ windowMs: 60000, max: 20, endpointName: 'voting' });
export const commentRateLimiter = rateLimit({ windowMs: 60000, max: 20, endpointName: 'comments' });
export const authRateLimiter = rateLimit({ windowMs: 60000, max: 20, endpointName: 'auth' });

export default rateLimit;
