import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Link2, Copy, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function TeamTester() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('hackhub_session_token') || '';

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.events?.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchTeams = async (eventId) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchMyTeams = async () => {
    const token = getToken();
    if (!token) {
      setMyTeams([]);
      return;
    }
    try {
      const res = await fetch('/api/teams/my-teams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyTeams(data.teams || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMyTeams();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchTeams(selectedEventId);
    }
  }, [selectedEventId]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setMessage(null);
    const token = getToken();

    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required. Please log in as a participant.' });
      return;
    }

    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: teamName })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Team created: ${data.team.name}` });
        setTeamName('');
        fetchTeams(selectedEventId);
        fetchMyTeams();
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleGenerateInvite = async (teamId) => {
    setMessage(null);
    const token = getToken();
    try {
      const res = await fetch(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedInvite(data.invitation);
        setMessage({ type: 'success', text: 'Invite token generated successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    setMessage(null);
    const token = getToken();

    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required. Please log in as a participant.' });
      return;
    }

    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: joinToken.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Successfully joined team: ${data.team.name}` });
        setJoinToken('');
        fetchTeams(selectedEventId);
        fetchMyTeams();
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="hero-card" style={{ marginTop: '2rem' }}>
      <div className="hero-header">
        <div className="hero-title">
          <Users size={24} color="#10b981" />
          <span>T1-04 Team Formation & Invite Links</span>
        </div>
        {events.length > 0 && (
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{
              padding: '0.4rem 0.8rem',
              background: '#0e131f',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              fontSize: '0.8rem'
            }}
          >
            {events.map((evt) => (
              <option key={evt._id} value={evt._id}>
                Event: {evt.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
        {/* Create Team & Join Team by Token */}
        <div>
          {/* Create Team Form */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
              Create Team (Participant Only)
            </div>
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Team Name (e.g. Cyber Squad)"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
                <UserPlus size={15} /> Create
              </button>
            </form>
          </div>

          {/* Join Team via Invite Token */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
              Join Team via Invite Link / Token
            </div>
            <form onSubmit={handleJoinTeam} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Paste Invite Token"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                required
                style={{
                  flex: 1,
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
              <button type="submit" className="btn-secondary" style={{ padding: '0.6rem 1rem' }}>
                <Link2 size={15} /> Join Team
              </button>
            </form>
          </div>

          {/* Feedback Message */}
          {message && (
            <div
              className={`status-pill ${message.type === 'success' ? 'healthy' : 'unhealthy'}`}
              style={{ width: '100%', marginTop: '1rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            >
              {message.text}
            </div>
          )}

          {/* Generated Invite Display */}
          {generatedInvite && (
            <div className="metric-card" style={{ marginTop: '1rem', borderColor: 'var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#a5b4fc' }}>
                <CheckCircle2 size={14} color="#10b981" /> Active Team Invitation
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', background: '#090c12', padding: '0.5rem', borderRadius: '4px', margin: '0.4rem 0' }}>
                Token: {generatedInvite.token}
              </div>
              <button
                className="btn-secondary"
                onClick={() => setJoinToken(generatedInvite.token)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', alignSelf: 'flex-start' }}
              >
                Copy to Join Input
              </button>
            </div>
          )}
        </div>

        {/* Teams in Event & Member Inspector */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
            Event Teams ({teams.length})
          </div>
          {teams.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No teams registered for this event yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '280px', overflowY: 'auto' }}>
              {teams.map((t) => (
                <div
                  key={t._id}
                  className="metric-card"
                  style={{ padding: '0.75rem 1rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {t.name}
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => handleGenerateInvite(t._id)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      <Link2 size={12} /> Invite
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    Members ({t.members?.length || 0}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {t.members?.map((m, idx) => (
                      <span
                        key={idx}
                        className="badge-tag"
                        style={{
                          fontSize: '0.7rem',
                          color: m.role === 'owner' ? '#fbbf24' : '#94a3b8',
                          borderColor: m.role === 'owner' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(255,255,255,0.08)'
                        }}
                      >
                        {m.userId?.email || 'User'} ({m.role})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
