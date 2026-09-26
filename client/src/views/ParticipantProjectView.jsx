import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FolderGit2, Edit3, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ParticipantProjectView() {
  const { sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const [activeProject, setActiveProject] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectMsg, setProjectMsg] = useState(null);
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

  const fetchTracks = async (eventId) => {
    if (!eventId) {
      setTracks([]);
      setSelectedTrackId('');
      return;
    }
    try {
      const res = await fetch(`/api/events/${eventId}/tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data.tracks || []);
        if (data.tracks?.length > 0) {
          setSelectedTrackId(data.tracks[0]._id);
        }
      }
    } catch {
      setTracks([]);
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
        const teams = data.teams || [];
        setMyTeams(teams);
        if (teams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(teams[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchTeamProject = async (teamId) => {
    if (!teamId || !sessionToken) return;
    try {
      const res = await fetch(`/api/projects?teamId=${teamId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.projects && data.projects.length > 0) {
          const p = data.projects[0];
          setActiveProject(p);
          setTitle(p.title || '');
          setDescription(p.description || '');
          setRepositoryUrl(p.repositoryUrl || '');
          if (p.trackId?._id) setSelectedTrackId(p.trackId._id);
        } else {
          setActiveProject(null);
          setTitle('');
          setDescription('');
          setRepositoryUrl('');
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchMyTeams();
  }, [sessionToken]);

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

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    setProjectMsg(null);
    if (!selectedEventId || !selectedTeamId || !title.trim()) return;

    setLoading(true);
    try {
      if (activeProject?._id) {
        // Update
        const res = await fetch(`/api/projects/${activeProject._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            repositoryUrl: repositoryUrl.trim(),
            trackId: selectedTrackId || undefined
          })
        });
        const data = await res.json();
        if (res.ok) {
          setActiveProject(data.project);
          setProjectMsg({ type: 'success', text: 'Project draft updated!' });
        } else {
          setProjectMsg({ type: 'error', text: data.message || data.error });
        }
      } else {
        // Create
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            eventId: selectedEventId,
            teamId: selectedTeamId,
            trackId: selectedTrackId || undefined,
            title: title.trim(),
            description: description.trim(),
            repositoryUrl: repositoryUrl.trim()
          })
        });
        const data = await res.json();
        if (res.ok) {
          setActiveProject(data.project);
          setProjectMsg({ type: 'success', text: 'Project draft created!' });
        } else {
          setProjectMsg({ type: 'error', text: data.message || data.error });
        }
      }
    } catch (err) {
      setProjectMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeProject?._id) return;
    setProjectMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${activeProject._id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActiveProject(data.project);
        setProjectMsg({
          type: 'success',
          text: 'Project submitted! It is now published in the public gallery.'
        });
      } else {
        setProjectMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setProjectMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">My Project</h1>
          <p className="page-description">Draft, edit, and submit your hackathon project.</p>
        </div>
      </div>

      {projectMsg && (
        <div className={`alert-box ${projectMsg.type === 'success' ? 'success' : 'error'}`}>
          {projectMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{projectMsg.text}</span>
        </div>
      )}

      {activeProject && (
        <div className="project-status-banner">
          <span className={`badge-tag ${activeProject.status === 'submitted' ? 'badge-submitted' : 'badge-draft'}`}>
            STATUS: {activeProject.status?.toUpperCase()}
          </span>
          <span className="text-muted-xs" style={{ marginLeft: '0.75rem' }}>
            {activeProject.status === 'submitted'
              ? 'This project has been submitted and is live in the public gallery.'
              : 'Draft status: Make sure to submit before the deadline.'}
          </span>
        </div>
      )}

      <div className="workspace-card" style={{ maxWidth: '720px' }}>
        <form onSubmit={handleSaveDraft} className="form-group-block">
          <div className="form-group">
            <label className="form-label">Submitting Team</label>
            <select
              className="form-input form-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              required
            >
              {myTeams.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Competition Track</label>
            <select
              className="form-input form-select"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
            >
              <option value="">General Track</option>
              {tracks.map((tr) => (
                <option key={tr._id} value={tr._id}>{tr.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Project Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Autonomous Workflow Orchestrator"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description & Architecture</label>
            <textarea
              className="form-input form-textarea"
              rows={4}
              placeholder="Provide an overview of what you built and how it works..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Repository URL</label>
            <input
              type="url"
              className="form-input"
              placeholder="https://github.com/my-team/my-project"
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
            />
          </div>

          <div className="actions-bar" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn-secondary" disabled={loading || !selectedTeamId}>
              <Edit3 size={15} />
              <span>{activeProject ? 'Update Draft' : 'Save as Draft'}</span>
            </button>

            {activeProject && activeProject.status === 'draft' && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                <Send size={15} />
                <span>Submit Project Explicitly</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
