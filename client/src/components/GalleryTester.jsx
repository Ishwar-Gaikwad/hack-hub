import React, { useState, useEffect } from 'react';
import { LayoutGrid, Search, Filter, ExternalLink, Users, Calendar, Award } from 'lucide-react';

export default function GalleryTester() {
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [loading, setLoading] = useState(false);

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
  const fetchGallery = async () => {
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
    fetchGallery();
  }, [selectedEventId, selectedTrackId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchGallery();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedEventId('');
    setSelectedTrackId('');
  };

  return (
    <div className="hero-card" style={{ marginTop: '2rem' }}>
      <div className="hero-header">
        <div className="hero-title">
          <LayoutGrid size={24} color="#38bdf8" />
          <span>T1-07 Public Project Gallery</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge-tag" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
            Public Access (No Auth Required)
          </span>
          <span className="badge-tag" style={{ color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ flex: '2 1 250px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search projects by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem 0.6rem 2.2rem',
                background: '#0e131f',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            />
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* Event Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: '#0e131f',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            >
              <option value="">All Events</option>
              {events.map((evt) => (
                <option key={evt._id} value={evt._id}>{evt.name}</option>
              ))}
            </select>
          </div>

          {/* Track Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <select
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              disabled={!selectedEventId}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: '#0e131f',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontSize: '0.85rem',
                opacity: selectedEventId ? 1 : 0.5
              }}
            >
              <option value="">All Tracks</option>
              {tracks.map((tr) => (
                <option key={tr._id} value={tr._id}>{tr.name}</option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
            <Search size={14} /> Search
          </button>

          {(searchQuery || selectedEventId || selectedTrackId) && (
            <button type="button" onClick={handleClearFilters} className="btn-secondary" style={{ padding: '0.6rem 0.9rem' }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading public gallery...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
          <LayoutGrid size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No Submitted Projects Found</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Only explicitly submitted projects appear in the public gallery. Try adjusting your search query or filters.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {projects.map((proj) => (
            <div
              key={proj._id}
              className="metric-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                transition: 'transform 0.2s, border-color 0.2s'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0, lineHeight: 1.3 }}>
                    {proj.title}
                  </h3>
                  <span
                    className="badge-tag"
                    style={{
                      color: '#34d399',
                      borderColor: 'rgba(52, 211, 153, 0.3)',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      flexShrink: 0
                    }}
                  >
                    SUBMITTED
                  </span>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {proj.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={13} color="#818cf8" />
                    <span><strong>Event:</strong> {proj.eventId?.name || 'Unknown Event'}</span>
                  </div>

                  {proj.trackId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Award size={13} color="#f59e0b" />
                      <span><strong>Track:</strong> {proj.trackId?.name || 'General'}</span>
                    </div>
                  )}

                  {proj.teamId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Users size={13} color="#34d399" />
                      <span><strong>Team:</strong> {proj.teamId?.name || 'Team'}</span>
                    </div>
                  )}
                </div>
              </div>

              {proj.repositoryUrl && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <a
                    href={proj.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem',
                      color: '#818cf8',
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={13} /> View Repository / Project
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
