import React, { useState, useEffect } from 'react';
import { FolderGit2, Search, Filter, ExternalLink, Users, Calendar, Award, CheckCircle2, RefreshCw } from 'lucide-react';
import ProjectDetailModal from '../components/ProjectDetailModal';

export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  // Fetch events for filtering
  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // ignore
    }
  };

  // Fetch tracks for selected event
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
      }
    } catch {
      setTracks([]);
    }
  };

  // Fetch public gallery projects with search & filters
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedEventId) params.append('eventId', selectedEventId);
      if (selectedTrackId) params.append('trackId', selectedTrackId);

      const url = `/api/projects?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      } else {
        setProjects([]);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchTracks(selectedEventId);
    } else {
      setTracks([]);
      setSelectedTrackId('');
    }
  }, [selectedEventId]);

  useEffect(() => {
    fetchProjects();
  }, [selectedEventId, selectedTrackId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedEventId('');
    setSelectedTrackId('');
  };

  return (
    <div className="page-view-container">
      {/* Page Header */}
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Explore Projects</h1>
          <p className="page-description">
            Discover innovative solutions, agentic workflows, and creative submissions created by participating hackathon teams.
          </p>
        </div>
        <div className="badge-tag badge-submitted" style={{ alignSelf: 'flex-start' }}>
          <CheckCircle2 size={13} />
          <span>{projects.length} {projects.length === 1 ? 'Submitted Project' : 'Submitted Projects'}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-panel">
        <form onSubmit={handleSearchSubmit} className="filter-form">
          {/* Keyword Search */}
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search projects by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Event Filter */}
          <div className="filter-select-wrapper">
            <select
              className="form-input form-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">All Events</option>
              {events.map((evt) => (
                <option key={evt._id} value={evt._id}>{evt.name}</option>
              ))}
            </select>
          </div>

          {/* Track Filter */}
          <div className="filter-select-wrapper">
            <select
              className="form-input form-select"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              disabled={!selectedEventId}
            >
              <option value="">All Tracks</option>
              {tracks.map((tr) => (
                <option key={tr._id} value={tr._id}>{tr.name}</option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <button type="submit" className="btn-primary">
            <Search size={14} />
            <span>Search</span>
          </button>

          {/* Clear Filters */}
          {(searchQuery || selectedEventId || selectedTrackId) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClearFilters}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="empty-loading-state">Loading submitted projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state-card">
          <FolderGit2 size={40} color="var(--text-muted)" />
          <h3>No Projects Match Your Search</h3>
          <p>Try refining your search keyword or clearing event/track filters.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {projects.map((proj) => (
            <div key={proj._id} className="project-card">
              <div className="project-card-header">
                <span className="badge-tag badge-submitted">
                  <CheckCircle2 size={12} />
                  <span>SUBMITTED</span>
                </span>
                {proj.trackId?.name && (
                  <span className="badge-tag" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    {proj.trackId.name}
                  </span>
                )}
              </div>

              <h2 className="project-card-title">{proj.title}</h2>
              <p className="project-card-desc">
                {proj.description || 'No description provided.'}
              </p>

              <div className="project-card-meta">
                <div className="meta-line">
                  <Calendar size={13} color="#818cf8" />
                  <span><strong>Event:</strong> {proj.eventId?.name || 'Hackathon Event'}</span>
                </div>
                {proj.teamId && (
                  <div className="meta-line">
                    <Users size={13} color="#34d399" />
                    <span><strong>Team:</strong> {proj.teamId.name}</span>
                  </div>
                )}
              </div>

              <div className="project-card-footer" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary btn-sm"
                  style={{ flex: '1 1 auto', justifyContent: 'center' }}
                  onClick={() => setSelectedProject(proj)}
                >
                  View Details
                </button>
                {proj.repositoryUrl && (
                  <a
                    href={proj.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outline btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} />
                    <span>Repo</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Details Modal */}
      <ProjectDetailModal
        project={selectedProject}
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
