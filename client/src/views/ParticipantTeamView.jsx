import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Link2, Copy, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ParticipantTeamView({ initialEventId = '', onNavigate }) {
  const { sessionToken, currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [myTeams, setMyTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [teamMsg, setTeamMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.events?.length > 0) {
          setSelectedEventId((current) => current || initialEventId || data.events[0]._id);
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
    } finally {
      setTeamsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMyTeams();
  }, [sessionToken]);

  useEffect(() => {
    if (initialEventId) setSelectedEventId(initialEventId);
  }, [initialEventId]);

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
        setGeneratedInvite({ ...data.invitation, teamId });
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

  const visibleTeams = initialEventId
    ? myTeams.filter((team) => String(team.eventId?._id || team.eventId) === String(initialEventId))
    : myTeams;

  return (
    <div className="page-view-container participant-page">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Your Team</h1>
          <p className="page-description">Set up your team for a hackathon, or join one with an invite.</p>
        </div>
      </div>

      {teamMsg && (
        <div className={`alert-box ${teamMsg.type === 'success' ? 'success' : 'error'}`} role="status">
          {teamMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{teamMsg.text}</span>
        </div>
      )}

      {teamsLoading ? <div className="empty-loading-state">Loading your teams...</div> : (
        <>
          {visibleTeams.length === 0 && (
            <section className="participant-next-step">
              <span className="participant-kicker">Next step</span>
              <h2>You haven’t joined a team yet.</h2>
              <p>Create one for this hackathon or join a teammate with their invite code.</p>
            </section>
          )}

          {visibleTeams.length > 0 && (
            <section className="participant-team-list" aria-label="Your teams">
              {visibleTeams.map((team) => (
                <article className="participant-team-card" key={team._id}>
                  <div className="participant-hackathon-heading">
                    <div>
                      <span className="participant-kicker">{team.eventId?.name || 'Hackathon team'}</span>
                      <h2>{team.name}</h2>
                    </div>
                    <span className="participant-member-count">{team.members?.length || 1} {team.members?.length === 1 ? 'member' : 'members'}</span>
                  </div>
                  <ul className="participant-member-list">
                    {(team.members || []).map((member) => {
                      const memberId = member.userId?._id || member.userId;
                      const isCurrentUser = String(memberId) === String(currentUser?._id || currentUser?.id);
                      return <li key={String(memberId)}>{member.userId?.email || 'Team member'}{isCurrentUser ? ' · You' : ''}</li>;
                    })}
                  </ul>
                  <div className="participant-team-actions">
                    <button className="btn-secondary" type="button" onClick={() => handleGenerateInvite(team._id)}>
                      <Link2 size={14} /> Invite teammates
                    </button>
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => onNavigate?.('my-project', { eventId: team.eventId?._id || team.eventId, teamId: team._id })}
                    >
                      Open My Project <ArrowRight size={15} />
                    </button>
                  </div>
                  {generatedInvite && generatedInvite.teamId === team._id && (
                    <div className="invite-box participant-invite-box">
                      <span className="text-muted-xs">Invite code</span>
                      <div className="invite-token-display">
                        <code>{generatedInvite.token}</code>
                        <button
                          className="btn-icon"
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedInvite.token);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          aria-label="Copy invite code"
                        >
                          {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}

          <details className="participant-secondary-flow" open={visibleTeams.length === 0}>
            <summary>{visibleTeams.length ? 'Create or join another team' : 'Team options'}</summary>
            <div className="participant-team-forms">
              <form onSubmit={handleCreateTeam} className="participant-form-block">
                <h2>Create Team</h2>
                <div className="form-group">
                  <label className="form-label" htmlFor="participant-team-event">Hackathon</label>
                  <select
                    id="participant-team-event"
                    className="form-input form-select"
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    required
                    disabled={events.length === 0}
                  >
                    {events.length === 0 && <option value="">No hackathons available</option>}
                    {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="participant-team-name">Team name</label>
                  <input
                    id="participant-team-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Agentic Pioneers"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading || events.length === 0}>
                  <UserPlus size={14} /> Create Team
                </button>
              </form>
              <form onSubmit={handleJoinTeam} className="participant-form-block">
                <h2>Join with invite</h2>
                <div className="form-group">
                  <label className="form-label" htmlFor="participant-team-invite">Invite code</label>
                  <input
                    id="participant-team-invite"
                    type="text"
                    className="form-input font-mono"
                    placeholder="Paste invite code"
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-secondary" disabled={loading}>Join Team</button>
              </form>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
