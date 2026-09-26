import User, { USER_ROLES } from '../models/user.model.js';
import Session from '../models/session.model.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { email, password, role } = req.body;

    // Validate email
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'A valid email address is required.'
      });
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Password is required and must be at least 6 characters long.'
      });
    }

    // Validate role if provided
    let userRole = 'participant';
    if (role) {
      if (!USER_ROLES.includes(role)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: `Invalid role specified. Supported roles are: ${USER_ROLES.join(', ')}.`
        });
      }
      userRole = role;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.'
      });
    }

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      password,
      role: userRole
    });

    // Create persistent server session
    const session = await Session.createSession(user._id);

    return res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      session: {
        token: session.token,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    console.error('[Auth Controller] Registration error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to complete registration.'
    });
  }
}

/**
 * Log in an existing user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.'
      });
    }

    // Create persistent server session
    const session = await Session.createSession(user._id);

    return res.status(200).json({
      message: 'Login successful',
      user: user.toJSON(),
      session: {
        token: session.token,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    console.error('[Auth Controller] Login error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to process login.'
    });
  }
}

/**
 * Log out and invalidate session
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    if (req.session && req.session.token) {
      await Session.invalidateSession(req.session.token);
    }

    return res.status(200).json({
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('[Auth Controller] Logout error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to process logout.'
    });
  }
}

/**
 * Get current authenticated user and session info
 * GET /api/auth/me
 */
export async function me(req, res) {
  return res.status(200).json({
    user: req.user.toJSON ? req.user.toJSON() : req.user,
    session: {
      token: req.session.token,
      expiresAt: req.session.expiresAt
    }
  });
}

export default {
  register,
  login,
  logout,
  me
};
