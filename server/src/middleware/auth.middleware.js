import Session from '../models/session.model.js';

/**
 * Extract token from request headers
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return authHeader.trim();
  }

  const customHeader = req.headers['x-session-token'];
  if (customHeader) {
    return customHeader.trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/session=([^;]+)/);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Authentication middleware enforcing valid active session
 */
export async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Missing session token.'
      });
    }

    const session = await Session.findValidSession(token);
    if (!session || !session.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session. Please log in again.'
      });
    }

    req.user = session.userId;
    req.session = session;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error verifying session:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to authenticate session.'
    });
  }
}

/**
 * Optional authentication middleware for public/visitor endpoints
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (token) {
      const session = await Session.findValidSession(token);
      if (session && session.userId) {
        req.user = session.userId;
        req.session = session;
      } else {
        req.user = null;
        req.session = null;
      }
    } else {
      req.user = null;
      req.session = null;
    }
    next();
  } catch (error) {
    req.user = null;
    req.session = null;
    next();
  }
}

export default {
  authenticate,
  optionalAuthenticate,
  extractToken
};
