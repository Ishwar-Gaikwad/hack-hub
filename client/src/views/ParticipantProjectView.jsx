import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Edit3, FolderGit2, Send, Users } from 'lucide-react';
import ProjectDetailModal from '../components/ProjectDetailModal';

const getId = (value) => String(value?._id || value || '');
const formatDeadline = (value) => value
  ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : 'To be announced';

export default function ParticipantProjectView({ initialEventId = '', initialTeamId = '', onNavigate }) {
  const { sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [tracks, setTracks] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [projectMsg, setProjectMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSubmittedProject, setEditingSubmittedProject] = useState(false);
  const [publicProjectOpen, setPublicProjectOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchWorkspace = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${sessionToken}` };
        const [eventResponse, teamsResponse, projectsResponse] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/teams/my-teams', { headers }),
          fetch('/api/projects/my-projects', { headers })
        ]);
        const [eventData, teamsData, projectsData] = await Promise.all([
          eventResponse.ok ? eventResponse.json() : { events: [] },
          teamsResponse.ok ? teamsResponse.json() : { teams: [] },
          projectsResponse.ok ? projectsResponse.json() : { projects: [] }
        ]);
        if (!active) return;
        const loadedTeams = teamsData.teams || [];
        const loadedProjects = projectsData.projects || [];
        setEvents(eventData.events || []);
        setMyTeams(loadedTeams);
        setProjects(loadedProjects);

        const preferredTeam = loadedTeams.find((team) => getId(team) === String(initialTeamId))
          || loadedTeams.find((team) => getId(team.eventId) === String(initialEventId))
          || loadedTeams[0];
        if (preferredTeam) {
          setSelectedTeamId(getId(preferredTeam));
          const project = loadedProjects.find((item) => getId(item.teamId) === getId(preferredTeam));
          setActiveProject(project || null);
          setTitle(project?.title || '');
          setDescription(project?.description || '');
          setRepositoryUrl(project?.repositoryUrl || '');
          setSelectedTrackId(getId(project?.trackId));
        }
      } catch {
        if (active) setProjectMsg({ type: 'error', text: 'Your project workspace could not be loaded. Please try again.' });
      } finally {
        if (active) setLoading(false);
      }
    };

    if (sessionToken) fetchWorkspace();
    return () => { active = false; };
  }, [sessionToken, initialEventId, initialTeamId]);

  const selectedTeam = myTeams.find((team) => getId(team) === selectedTeamId);
  const eventId = getId(selectedTeam?.eventId);
  const event = events.find((item) => getId(item) === eventId) || (selectedTeam?.eventId && typeof selectedTeam.eventId === 'object' ? selectedTeam.eventId : null);

  useEffect(() => {
    let active = true;
    const fetchTracks = async () => {
      if (!eventId) {
        setTracks([]);
        setSelectedTrackId('');
        return;
      }
      try {
        const response = await fetch(`/api/events/${eventId}/tracks`);
        const data = response.ok ? await response.json() : { tracks: [] };
        if (!active) return;
        const availableTracks = data.tracks || [];
        setTracks(availableTracks);
        if (activeProject?.trackId && availableTracks.some((track) => getId(track) === getId(activeProject.trackId))) {
          setSelectedTrackId(getId(activeProject.trackId));
        } else if (!availableTracks.some((track) => getId(track) === selectedTrackId)) {
          setSelectedTrackId(availableTracks[0] ? getId(availableTracks[0]) : '');
        }
      } catch {
        if (active) setTracks([]);
      }
    };
    fetchTracks();
    return () => { active = false; };
  }, [eventId, activeProject?._id]);

  const handleTeamChange = (nextTeamId) => {
    const nextTeam = myTeams.find((team) => getId(team) === nextTeamId);
    const nextProject = projects.find((project) => getId(project.teamId) === nextTeamId) || null;
    setSelectedTeamId(nextTeamId);
    setActiveProject(nextProject);
    setTitle(nextProject?.title || '');
    setDescription(nextProject?.description || '');
    setRepositoryUrl(nextProject?.repositoryUrl || '');
    setSelectedTrackId(getId(nextProject?.trackId));
    setProjectMsg(null);
    setEditingSubmittedProject(false);
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    setProjectMsg(null);
    if (!eventId || !selectedTeamId || !selectedTrackId || title.trim().length < 2) return;

    setSaving(true);
    try {
      const isUpdate = Boolean(activeProject?._id);
      const response = await fetch(isUpdate ? `/api/projects/${activeProject._id}` : '/api/projects', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          ...(isUpdate ? {} : { eventId, teamId: selectedTeamId }),
          title: title.trim(),
          description: description.trim(),
          repositoryUrl: repositoryUrl.trim(),
          trackId: selectedTrackId
        })
      });
      const data = await response.json();
      if (response.ok) {
        setActiveProject(data.project);
        setProjects((current) => [...current.filter((project) => getId(project) !== getId(data.project)), data.project]);
        setEditingSubmittedProject(false);
        setProjectMsg({ type: 'success', text: isUpdate ? 'Project changes saved.' : 'Draft saved.' });
      } else {
        setProjectMsg({ type: 'error', text: data.message || data.error || 'Could not save the project.' });
      }
    } catch (error) {
      setProjectMsg({ type: 'error', text: error.message || 'Could not save the project.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeProject?._id) return;
    setProjectMsg(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${activeProject._id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await response.json();
      if (response.ok) {
        setActiveProject(data.project);
        setProjects((current) => current.map((project) => getId(project) === getId(data.project) ? data.project : project));
        setProjectMsg({ type: 'success', text: 'Your project is now submitted to the public gallery.' });
      } else {
        setProjectMsg({ type: 'error', text: data.message || data.error || 'Could not submit the project.' });
      }
    } catch (error) {
      setProjectMsg({ type: 'error', text: error.message || 'Could not submit the project.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="empty-loading-state">Loading your project...</div>;

  if (myTeams.length === 0) {
    return (
      <div className="page-view-container participant-page">
        <div className="page-header-block"><div className="page-title-group"><h1 className="page-title">My Project</h1><p className="page-description">Your project starts with a team.</p></div></div>
        <section className="participant-next-step">
          <Users size={22} />
          <h2>Create or join a team first.</h2>
          <p>HackHub projects belong to a team participating in a hackathon.</p>
          <button className="btn-primary" onClick={() => onNavigate?.('my-team', { eventId: initialEventId })}>Set up your team <ArrowRight size={15} /></button>
        </section>
      </div>
    );
  }

  const projectIsSubmitted = activeProject?.status === 'submitted';
  const showProjectForm = !projectIsSubmitted || editingSubmittedProject;

  return (
    <div className="page-view-container participant-page">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">My Project</h1>
          <p className="page-description">Build your team’s submission and share it with the gallery.</p>
        </div>
      </div>

      {projectMsg && (
        <div className={`alert-box ${projectMsg.type === 'success' ? 'success' : 'error'}`} role="status">
          {projectMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{projectMsg.text}</span>
        </div>
      )}

      {myTeams.length > 1 && (
        <div className="participant-project-context">
          <label className="form-label" htmlFor="participant-project-team">Team</label>
          <select id="participant-project-team" className="form-input form-select" value={selectedTeamId} onChange={(e) => handleTeamChange(e.target.value)}>
            {myTeams.map((team) => <option key={team._id} value={team._id}>{team.name} · {team.eventId?.name || 'Hackathon'}</option>)}
          </select>
        </div>
      )}

      <section className="participant-project-workspace">
        <div className="participant-project-context-row">
          <div>
            <span className="participant-kicker">{event?.name || 'Hackathon workspace'}</span>
            <h2>{activeProject?.title || 'Start your project'}</h2>
            <span className="participant-context-team"><Users size={14} /> {selectedTeam?.name || 'Your team'}</span>
          </div>
          {event?.submissionDeadline && (
            <div className="participant-deadline">
              <span><Clock size={14} /> Submission deadline</span>
              <strong>{formatDeadline(event.submissionDeadline)}</strong>
            </div>
          )}
        </div>

        {projectIsSubmitted && !editingSubmittedProject ? (
          <div className="participant-submitted-state">
            <div className="participant-submitted-mark"><CheckCircle2 size={20} /></div>
            <div className="participant-submitted-copy">
              <h3>Project submitted</h3>
              <p>Your project is published in the public gallery{activeProject.updatedAt ? ` · ${formatDeadline(activeProject.updatedAt)}` : ''}.</p>
            </div>
            <div className="participant-submitted-actions">
              <button className="btn-primary" type="button" onClick={() => setPublicProjectOpen(true)}>
                View Project <ArrowRight size={15} />
              </button>
              <button className="btn-secondary" type="button" onClick={() => setEditingSubmittedProject(true)}>
                <Edit3 size={14} /> Edit submission
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveDraft} className="participant-project-form">
            {tracks.length === 0 && <p className="participant-form-note">This hackathon has no tracks yet. Ask the organizer to configure a track before saving a project.</p>}
            <div className="form-group">
              <label className="form-label" htmlFor="participant-project-title">Project name</label>
              <input id="participant-project-title" className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="participant-project-track">Track</label>
              <select id="participant-project-track" className="form-input form-select" value={selectedTrackId} onChange={(e) => setSelectedTrackId(e.target.value)} required disabled={tracks.length === 0}>
                <option value="" disabled>Select a track</option>
                {tracks.map((track) => <option key={track._id} value={track._id}>{track.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="participant-project-description">Description</label>
              <textarea id="participant-project-description" className="form-input form-textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does your team’s project do?" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="participant-project-repository">Repository URL</label>
              <input id="participant-project-repository" className="form-input" type="url" value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} placeholder="https://github.com/team/project" />
            </div>
            <div className="participant-project-actions">
              <button type="submit" className="btn-secondary" disabled={saving || !selectedTrackId || title.trim().length < 2}>
                <Edit3 size={14} /> {activeProject ? 'Save Changes' : 'Save Draft'}
              </button>
              {activeProject?.status === 'draft' && (
                <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving}>
                  <Send size={14} /> Submit Project
                </button>
              )}
              {editingSubmittedProject && <button type="button" className="btn-outline" onClick={() => setEditingSubmittedProject(false)}>Cancel</button>}
            </div>
            {projectIsSubmitted && <p className="participant-form-note">Edits remain visible in the public gallery. The server will enforce the event deadline.</p>}
          </form>
        )}
      </section>

      <ProjectDetailModal project={activeProject} isOpen={publicProjectOpen} onClose={() => setPublicProjectOpen(false)} />
    </div>
  );
}
