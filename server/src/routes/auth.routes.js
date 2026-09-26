import { Router } from 'express';
import { register, login, logout, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Public authentication endpoints
router.post('/register', register);
router.post('/login', login);

// Protected session endpoints
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

// Role verification test endpoints for DOGFOOD validation
router.get('/role-check/participant', authenticate, requireRole('participant'), (req, res) => {
  res.status(200).json({ status: 'granted', role: req.user.role, message: 'Welcome participant' });
});

router.get('/role-check/judge', authenticate, requireRole('judge'), (req, res) => {
  res.status(200).json({ status: 'granted', role: req.user.role, message: 'Welcome judge' });
});

router.get('/role-check/organizer', authenticate, requireRole('organizer'), (req, res) => {
  res.status(200).json({ status: 'granted', role: req.user.role, message: 'Welcome organizer' });
});

router.get('/role-check/admin', authenticate, requireRole('admin'), (req, res) => {
  res.status(200).json({ status: 'granted', role: req.user.role, message: 'Welcome admin' });
});

router.get('/role-check/staff', authenticate, requireRole('organizer', 'admin'), (req, res) => {
  res.status(200).json({ status: 'granted', role: req.user.role, message: 'Welcome organizer or admin' });
});

export default router;
