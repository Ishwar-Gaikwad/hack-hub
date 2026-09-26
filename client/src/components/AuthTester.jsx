import React, { useState, useEffect } from 'react';
import { UserCheck, LogIn, UserPlus, LogOut, ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react';

const ROLES = ['participant', 'judge', 'organizer', 'admin'];

export default function AuthTester() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('hackhub_session_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('participant');
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [authMessage, setAuthMessage] = useState(null);
  const [roleTestResult, setRoleTestResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check current session on mount or token change
  useEffect(() => {
    if (sessionToken) {
      fetchCurrentSession(sessionToken);
    } else {
      setCurrentUser(null);
    }
  }, [sessionToken]);

  const fetchCurrentSession = async (token) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        // Expired or invalid
        localStorage.removeItem('hackhub_session_token');
        setSessionToken('');
        setCurrentUser(null);
      }
    } catch {
      // Network/offline
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthMessage(null);
    setRoleTestResult(null);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = mode === 'register' 
      ? { email, password, role } 
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('hackhub_session_token', data.session.token);
        setSessionToken(data.session.token);
        setCurrentUser(data.user);
        setAuthMessage({ type: 'success', text: data.message || 'Authentication successful' });
        setEmail('');
        setPassword('');
      } else {
        setAuthMessage({ type: 'error', text: data.message || data.error || 'Request failed' });
      }
    } catch (err) {
      setAuthMessage({ type: 'error', text: err.message || 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      if (sessionToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
      }
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('hackhub_session_token');
      setSessionToken('');
      setCurrentUser(null);
      setAuthMessage({ type: 'success', text: 'Logged out successfully' });
      setRoleTestResult(null);
      setLoading(false);
    }
  };

  const testRoleEndpoint = async (checkRole) => {
    setRoleTestResult(null);
    try {
      const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
      const res = await fetch(`/api/auth/role-check/${checkRole}`, { headers });
      const data = await res.json();

      setRoleTestResult({
        roleTested: checkRole,
        status: res.status,
        data
      });
    } catch (err) {
      setRoleTestResult({
        roleTested: checkRole,
        status: 'Error',
        data: { error: err.message }
      });
    }
  };

  return (
    <div className="hero-card" style={{ marginTop: '2rem' }}>
      <div className="hero-header">
        <div className="hero-title">
          <KeyRound size={24} color="#a855f7" />
          <span>T1-02 Authentication & RBAC Verification</span>
        </div>
        <div>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge-tag" style={{ textTransform: 'capitalize', color: '#818cf8', borderColor: '#6366f1' }}>
                Role: {currentUser.role}
              </span>
              <button className="btn-secondary" onClick={handleLogout} disabled={loading} style={{ padding: '0.4rem 0.8rem' }}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            <span className="badge-tag" style={{ color: '#94a3b8' }}>
              Visitor (Unauthenticated)
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
        {/* Auth Form / User State */}
        <div>
          {currentUser ? (
            <div className="metric-card" style={{ height: '100%', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <UserCheck size={28} color="#10b981" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentUser.email}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {currentUser._id || currentUser.id}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div><strong>Active Role:</strong> <span style={{ color: '#a78bfa', fontWeight: 600 }}>{currentUser.role}</span></div>
                <div><strong>Token:</strong> <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{sessionToken.substring(0, 16)}...</span></div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  className={mode === 'login' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => { setMode('login'); setAuthMessage(null); }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <LogIn size={14} /> Log In
                </button>
                <button
                  className={mode === 'register' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => { setMode('register'); setAuthMessage(null); }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <UserPlus size={14} /> Register
                </button>
              </div>

              <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    padding: '0.65rem 0.9rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    padding: '0.65rem 0.9rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    outline: 'none'
                  }}
                />

                {mode === 'register' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Select Initial Role:</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{
                        padding: '0.65rem 0.9rem',
                        background: '#0e131f',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        outline: 'none'
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
                  {loading ? 'Processing...' : (mode === 'register' ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              {authMessage && (
                <div 
                  className={`status-pill ${authMessage.type === 'success' ? 'healthy' : 'unhealthy'}`}
                  style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                >
                  {authMessage.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Role Access Testing Matrix */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Backend Role Authorization Verification
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {ROLES.map((r) => (
              <button
                key={r}
                className="btn-secondary"
                onClick={() => testRoleEndpoint(r)}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', justifyContent: 'center' }}
              >
                Test {r.charAt(0).toUpperCase() + r.slice(1)} Only
              </button>
            ))}
            <button
              className="btn-secondary"
              onClick={() => testRoleEndpoint('staff')}
              style={{ gridColumn: 'span 2', fontSize: '0.8rem', padding: '0.5rem 0.75rem', justifyContent: 'center' }}
            >
              Test Staff (Organizer or Admin)
            </button>
          </div>

          {roleTestResult && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                {roleTestResult.status === 200 ? (
                  <ShieldCheck size={18} color="#10b981" />
                ) : (
                  <ShieldAlert size={18} color="#ef4444" />
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: roleTestResult.status === 200 ? '#10b981' : '#ef4444' }}>
                  HTTP {roleTestResult.status} {roleTestResult.status === 200 ? 'Access Granted' : (roleTestResult.status === 403 ? 'Forbidden (403)' : 'Unauthorized (401)')}
                </span>
              </div>
              <pre className="json-container" style={{ margin: 0, padding: '0.75rem', fontSize: '0.75rem' }}>
                <code>{JSON.stringify(roleTestResult.data, null, 2)}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
