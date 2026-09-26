import React, { useState, useEffect } from 'react';
import { FolderGit2, Send, Edit3, CheckCircle2, Clock } from 'lucide-react';

export default function ProjectTester() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const [project, setProject] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
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

  const fetchTracks = async (eventId) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
        if (data.tracks?.length > 0) {
          setSelectedTrackId(data.tracks[0]._id);
        } else {
          setSelectedTrackId('');
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchMyTeams = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/teams/my-teams', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyTeams(data.teams || []);
        if (data.teams?.length > 0 && !selectedTeamId) {
          setSelectedTeamId(data.teams[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchTeamProject = async (teamId) => {
    if (!teamId) {
      setProject(null);
      return;
    }
    try {
      const res = await fetch(`/api/teams/${teamId}/project`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setTitle(data.project.title);
        setDescription(data.project.description || '');
        setRepositoryUrl(data.project.repositoryUrl || '');
        if (data.project.trackId?._id) {
          setSelectedTrackId(data.project.trackId._id);
        }
      } else {
        setProject(null);
        setTitle('');
        setDescription('');
        setRepositoryUrl('');
      }
    } catch {
      setProject(null);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMyTeams();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchTracks(selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamProject(selectedTeamId);
    }
  }, [selectedTeamId]);

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    setMessage(null);
    const token = getToken();

    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required. Please sign in as a participant.' });
      return;
    }

    if (!selectedTeamId || !selectedTrackId || !selectedEventId) {
      setMessage({ type: 'error', text: 'Event, team, and track must be selected.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId: selectedEventId,
          teamId: selectedTeamId,
          trackId: selectedTrackId,
          title,
          description,
          repositoryUrl
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Project created as DRAFT successfully!' });
        setProject(data.project);
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDraft = async (e) => {
    e.preventDefault();
    if (!project) return;
    setMessage(null);
    const token = getToken();

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          repositoryUrl,
          trackId: selectedTrackId
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Project updated successfully!' });
        setProject(data.project);
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProject = async () => {
    if (!project) return;
    setMessage(null);
    const token = getToken();

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project._id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Project SUBMITTED successfully!' });
        setProject(data.project);
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-card" style={{ marginTop: '2rem' }}>
      <div className="hero-header">
        <div className="hero-title">
          <FolderGit2 size={24} color="#ec4899" />
          <span>T1-05 Project Submission & Drafts</span>
        </div>
        {project && (
          <span
            className={`status-pill ${project.status === 'submitted' ? 'healthy' : 'unhealthy'}`}
            style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}
          >
            {project.status === 'submitted' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            <span>Status: {project.status}</span>
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
        {/* Project Form */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
            {project ? 'Edit Project' : 'Create Project Draft'}
          </div>

          <form onSubmit={project ? handleUpdateDraft : handleCreateDraft} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {!project && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Event:</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0e131f', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.75rem' }}
                  >
                    {events.map((evt) => (
                      <option key={evt._id} value={evt._id}>{evt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your Team:</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: '#0e131f', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.75rem' }}
                  >
                    {myTeams.length === 0 ? (
                      <option value="">No team found</option>
                    ) : (
                      myTeams.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Track:</label>
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: '#0e131f', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.75rem' }}
              >
                {tracks.length === 0 ? (
                  <option value="">No tracks available</option>
                ) : (
                  tracks.map((tr) => (
                    <option key={tr._id} value={tr._id}>{tr.name}</option>
                  ))
                )}
              </select>
            </div>

            <input
              type="text"
              placeholder="Project Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              style={{
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />

            <textarea
              placeholder="Project Description / Summary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem',
                resize: 'vertical'
              }}
            />

            <input
              type="url"
              placeholder="Repository or Project URL (optional)"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              style={{
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
              <button
                type="submit"
                disabled={loading}
                className={project ? 'btn-secondary' : 'btn-primary'}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Edit3 size={15} /> {project ? 'Save Edits' : 'Save as Draft'}
              </button>

              {project && project.status !== 'submitted' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmitProject}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  <Send size={15} /> Submit Project
                </button>
              )}
            </div>
          </form>

          {message && (
            <div
              className={`status-pill ${message.type === 'success' ? 'healthy' : 'unhealthy'}`}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Project Inspector */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
            Current Project Details
          </div>

          {project ? (
            <div className="metric-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f8fafc' }}>
                  {project.title}
                </div>
                <span
                  className="badge-tag"
                  style={{
                    color: project.status === 'submitted' ? '#34d399' : '#f59e0b',
                    borderColor: project.status === 'submitted' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                  }}
                >
                  {project.status.toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div><strong>Event:</strong> {project.eventId?.name || project.eventId}</div>
                <div><strong>Team:</strong> {project.teamId?.name || project.teamId}</div>
                <div><strong>Track:</strong> {project.trackId?.name || project.trackId}</div>
                <div><strong>Description:</strong> {project.description || '(No description provided)'}</div>
                <div>
                  <strong>Repository:</strong>{' '}
                  {project.repositoryUrl ? (
                    <a href={project.repositoryUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>
                      {project.repositoryUrl}
                    </a>
                  ) : (
                    'None'
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Created: {new Date(project.createdAt).toLocaleString()} | Last Updated: {new Date(project.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Select a team with an existing project or create a new draft above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
