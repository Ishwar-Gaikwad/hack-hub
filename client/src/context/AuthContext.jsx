import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('hackhub_session_token') || '');
  const [loading, setLoading] = useState(true);

  const fetchCurrentSession = async (token) => {
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        localStorage.removeItem('hackhub_session_token');
        setSessionToken('');
        setCurrentUser(null);
      }
    } catch {
      // offline / network error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchCurrentSession(sessionToken);
    } else {
      setLoading(false);
    }
  }, [sessionToken]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.session?.token) {
      localStorage.setItem('hackhub_session_token', data.session.token);
      setSessionToken(data.session.token);
      setCurrentUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.message || data.error || 'Login failed' };
  };

  const register = async (email, password, role = 'participant') => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    const data = await res.json();
    if (res.ok && data.session?.token) {
      localStorage.setItem('hackhub_session_token', data.session.token);
      setSessionToken(data.session.token);
      setCurrentUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, error: data.message || data.error || 'Registration failed' };
  };

  const logout = async () => {
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
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, sessionToken, loading, login, register, logout, refreshSession: () => fetchCurrentSession(sessionToken) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
