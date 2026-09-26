import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Link2, Copy, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ParticipantTeamView() {
  const { sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [teamMsg, setTeamMsg] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const fetchMyTeams = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/teams/my-teams', {
        headers: { Authorization: `Bearer ${sessionToken}` }
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
  }, [sessionToken]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setTeamMsg(null);
    if (!selectedEventId || !newTeamName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${selectedEventId}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ name: newTeamName.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setTeamMsg({ type: 'success', text: `Team "${data.team.name}" created!` });
        setNewTeamName('');
        fetchMyTeams();
      } else {
        setTeamMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setTeamMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvite = async (teamId) => {
    setTeamMsg(null);
    setGeneratedInvite(null);
    setCopied(false);

    try {
      const res = await fetch(`/api/teams/${teamId}/invites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedInvite(data.invitation);
        setTeamMsg({ type: 'success', text: 'Invite token generated.' });
      } else {
        setTeamMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setTeamMsg({ type: 'error', text: err.message });
    }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    setTeamMsg(null);
    if (!joinToken.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ token: joinToken.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setTeamMsg({ type: 'success', text: `Joined ${data.team.name}!` });
        setJoinToken('');
        fetchMyTeams();
      } else {
        setTeamMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setTeamMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">My Team</h1>
          <p className="page-description">Manage your hackathon team and teammate invitations.</p>
        </div>
      </div>

      {teamMsg && (
        <div className={`alert-box ${teamMsg.type === 'success' ? 'success' : 'error'}`}>
          {teamMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{teamMsg.text}</span>
        </div>
      )}

      <div className="workspace-layout">
        {/* Create / Join Team */}
        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '1rem' }}>Create Team</h2>
          <form onSubmit={handleCreateTeam} className="form-group-block">
            <div className="form-group">
              <label className="form-label">Event</label>
              <select
                className="form-input form-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>{evt.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Team Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Agentic Pioneers"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              <UserPlus size={14} />
              <span>Create Team</span>
            </button>
          </form>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <h2 className="card-heading" style={{ marginBottom: '1rem' }}>Join Existing Team</h2>
            <form onSubmit={handleJoinTeam}>
              <div className="form-group">
                <label className="form-label">Invite Code</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="Paste invitation token..."
                  value={joinToken}
                  onChange={(e) => setJoinToken(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-secondary" disabled={loading}>
                Join Team
              </button>
            </form>
          </div>
        </div>

        {/* Current Teams List */}
        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '1rem' }}>Active Teams ({myTeams.length})</h2>
          {myTeams.length === 0 ? (
            <div className="text-muted-sm">You are not a member of any team yet.</div>
          ) : (
            <div className="teams-vertical-list">
              {myTeams.map((team) => (
                <div key={team._id} className="team-item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{team.name}</div>
                    <span className="badge-tag">
                      {team.members?.length || 1} {team.members?.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  <div className="text-muted-xs" style={{ margin: '0.4rem 0' }}>
                    Event: {team.eventId?.name || 'Hackathon Event'}
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => handleGenerateInvite(team._id)}
                    >
                      <Link2 size={12} />
                      <span>Generate Teammate Invite</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {generatedInvite && (
            <div className="invite-box" style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#34d399', marginBottom: '0.25rem' }}>
                Invitation Token:
              </div>
              <div className="invite-token-display">
                <code>{generatedInvite.token}</code>
                <button
                  className="btn-icon"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedInvite.token);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title="Copy token"
                >
                  {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
              <span className="text-muted-xs">Share this token with your teammates to let them join.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
