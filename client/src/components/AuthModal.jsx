import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

const ROLES = [
  { id: 'participant', label: 'Participant (Build & Submit Projects)' },
  { id: 'organizer', label: 'Organizer (Create Events, Tracks, Prizes)' },
  { id: 'judge', label: 'Judge (Review & Score)' },
  { id: 'admin', label: 'Admin (System Management)' }
];

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('participant');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await register(email, password, role);
      }

      if (result.success) {
        onClose();
        setEmail('');
        setPassword('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="icon-badge">
              <KeyRound size={20} color="#a855f7" />
            </div>
            <div>
              <h2 className="modal-title">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
              <p className="modal-subtitle">
                {mode === 'login' ? 'Sign in to access your hackathons and teams' : 'Join HackHub to build, collaborate, and compete'}
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="tab-pill-group">
          <button
            type="button"
            className={`tab-pill ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            className={`tab-pill ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
          >
            <UserPlus size={15} /> Register
          </button>
        </div>

        {error && (
          <div className="alert-box error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. alice@hackhub.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Account Role</label>
              <select
                className="form-input form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Authenticating...' : (mode === 'login' ? 'Sign In to HackHub' : 'Create Account')}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => { setMode('register'); setError(null); }}
                >
                  Create one now
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => { setMode('login'); setError(null); }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
