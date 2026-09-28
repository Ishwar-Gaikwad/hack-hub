import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Search,
  ExternalLink,
  Users,
  Calendar,
  Award,
  CheckCircle2,
  ThumbsUp,
  Shuffle,
  Trophy,
  AlertCircle,
  Clock
} from 'lucide-react';
import ProjectDetailModal from '../components/ProjectDetailModal';
import { useAuth } from '../context/AuthContext';
import { getFriendlyErrorMessage } from '../utils/formatters';

export default function ProjectsView() {
  const { currentUser, sessionToken } = useAuth();
  const [projects, setProjects] = useState([]);
  const [events, setEvents] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  // T3 Community Voting State
  const [votingStatus, setVotingStatus] = useState(null);
  const [userVotes, setUserVotes] = useState(new Set());
  const [ballotMode, setBallotMode] = useState(false);
  const [viewResultsMode, setViewResultsMode] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [voteError, setVoteError] = useState('');
  const [voteNotice, setVoteNotice] = useState('');

  // Fetch events for filtering
  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        const evts = data.events || [];
        setEvents(evts);
        if (evts.length > 0 && !selectedEventId) {
          setSelectedEventId(evts[0]._id);
        }
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

  // Fetch voting status for selected event
  const fetchVotingStatus = async (eventId) => {
    if (!eventId) return;
    try {
      const headers = {};
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/events/${eventId}/voting`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVotingStatus(data);
        setUserVotes(new Set(data.userVotes || []));
      }
    } catch {
      // ignore
    }
  };

  // Fetch projects (standard or randomized ballot)
  const fetchProjects = async () => {
    setLoading(true);
    setVoteError('');
    try {
      if (ballotMode && selectedEventId) {
        // Fetch randomized ballot
        const headers = {};
        if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
        const res = await fetch(`/api/events/${selectedEventId}/ballot`, { headers });
        if (res.ok) {
          const data = await res.json();
          setProjects(data.ballotOrder || []);
        }
      } else {
        // Standard gallery fetch
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
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch results when requested
  const fetchResults = async (eventId) => {
    if (!eventId) return;
    try {
      const headers = {};
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
      const res = await fetch(`/api/events/${eventId}/results`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResultsData(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchTracks(selectedEventId);
      fetchVotingStatus(selectedEventId);
      if (viewResultsMode) {
        fetchResults(selectedEventId);
      }
    } else {
      setTracks([]);
      setSelectedTrackId('');
      setVotingStatus(null);
    }
  }, [selectedEventId, sessionToken]);

  useEffect(() => {
    if (!viewResultsMode) {
      fetchProjects();
    } else if (selectedEventId) {
      fetchResults(selectedEventId);
    }
  }, [selectedEventId, selectedTrackId, ballotMode, viewResultsMode]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setBallotMode(false);
    fetchProjects();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedTrackId('');
    setBallotMode(false);
  };

  // Handle Vote Casting / Retraction
  const handleVoteToggle = async (projectId) => {
    if (!sessionToken) {
      setVoteError('Please log in to cast your community vote.');
      return;
    }
    if (!selectedEventId) return;

    setVoteError('');
    const hasVoted = userVotes.has(projectId.toString());

    try {
      const url = `/api/events/${selectedEventId}/projects/${projectId}/vote`;
      const res = await fetch(url, {
        method: hasVoted ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      const data = await res.json();
      if (res.ok) {
        setUserVotes(prev => {
          const updated = new Set(prev);
          if (hasVoted) {
            updated.delete(projectId.toString());
          } else {
            updated.add(projectId.toString());
          }
          return updated;
        });
        setVoteNotice(hasVoted ? 'Vote retracted.' : 'Vote recorded! Thank you for supporting this project.');
        fetchVotingStatus(selectedEventId);
      } else {
        setVoteError(getFriendlyErrorMessage(data.message || data.error, 'Vote action could not be processed.'));
      }
    } catch (err) {
      setVoteError(getFriendlyErrorMessage(err, 'Network error while processing vote.'));
    }
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={ballotMode ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => {
              setViewResultsMode(false);
              setBallotMode(prev => !prev);
            }}
            title="Randomized ordering to prevent position bias"
          >
            <Shuffle size={14} />
            <span>{ballotMode ? 'Randomized Ballot (Active)' : 'Randomized Ballot'}</span>
          </button>

          <button
            type="button"
            className={viewResultsMode ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
            onClick={() => {
              setBallotMode(false);
              setViewResultsMode(prev => !prev);
            }}
          >
            <Trophy size={14} />
            <span>Community Results</span>
          </button>
        </div>
      </div>

      {/* Voting Window Status Banner */}
      {votingStatus && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: votingStatus.isOpen
              ? 'rgba(34, 197, 94, 0.1)'
              : 'rgba(100, 116, 139, 0.15)',
            border: `1px solid ${votingStatus.isOpen ? 'rgba(34, 197, 94, 0.25)' : 'rgba(100, 116, 139, 0.25)'}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Clock size={16} color={votingStatus.isOpen ? '#4ade80' : '#94a3b8'} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f1f5f9' }}>
              {votingStatus.isOpen
                ? 'Community Voting is Open — Support your favorite projects!'
                : votingStatus.reason === 'not_started'
                ? `Community voting opens soon on ${new Date(votingStatus.votingOpenAt).toLocaleDateString()}`
                : 'Community voting has closed for this event.'}
            </span>
          </div>

          {userVotes.size > 0 && (
            <span className="badge-tag badge-submitted" style={{ margin: 0 }}>
              <ThumbsUp size={12} />
              <span>You voted for {userVotes.size} {userVotes.size === 1 ? 'project' : 'projects'}</span>
            </span>
          )}
        </div>
      )}

      {/* Vote Notice Confirmation Banner */}
      {voteNotice && (
        <div style={{ padding: '0.65rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', borderRadius: '6px', color: '#86efac', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} color="#4ade80" />
            <span>{voteNotice}</span>
          </div>
          <button type="button" onClick={() => setVoteNotice('')} style={{ background: 'none', border: 'none', color: '#86efac', cursor: 'pointer', fontSize: '0.8rem' }}>&times;</button>
        </div>
      )}

      {/* Vote Error Feedback Banner */}
      {voteError && (
        <div style={{ padding: '0.65rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            <span>{voteError}</span>
          </div>
          <button type="button" onClick={() => setVoteError('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '0.8rem' }}>&times;</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      {!viewResultsMode && (
        <div className="filter-panel">
          <form onSubmit={handleSearchSubmit} className="filter-form">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search projects by title or description..."
                value={searchQuery}
                disabled={ballotMode}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-select-wrapper">
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

            <div className="filter-select-wrapper">
              <select
                className="form-input form-select"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                disabled={!selectedEventId || ballotMode}
              >
                <option value="">All Tracks</option>
                {tracks.map((tr) => (
                  <option key={tr._id} value={tr._id}>{tr.name}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={ballotMode}>
              <Search size={14} />
              <span>Search</span>
            </button>

            {(searchQuery || selectedTrackId) && (
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
      )}

      {/* View: Community Results */}
      {viewResultsMode ? (
        <div style={{ marginTop: '1rem' }}>
          {resultsData?.resultsHidden ? (
            <div className="empty-state-card">
              <Clock size={40} color="#818cf8" />
              <h3>Live Vote Totals are Private</h3>
              <p>{resultsData.message}</p>
            </div>
          ) : resultsData?.results ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  Community Voting Leaderboard
                </h3>
                <span className="badge-tag" style={{ margin: 0 }}>
                  {resultsData.totalVotes} Total Votes Recorded
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {resultsData.results.map((r) => (
                  <div
                    key={r.projectId}
                    style={{
                      padding: '1rem 1.25rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: r.rank === 1 ? '#eab308' : r.rank === 2 ? '#94a3b8' : r.rank === 3 ? '#d97706' : 'rgba(255, 255, 255, 0.1)',
                          color: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}
                      >
                        {r.rank}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                          {r.title}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {r.teamName} &bull; {r.trackName}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="badge-tag badge-submitted" style={{ fontSize: '0.85rem' }}>
                        <ThumbsUp size={13} />
                        <span>{r.votes} {r.votes === 1 ? 'Vote' : 'Votes'}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-loading-state">Loading results...</div>
          )}
        </div>
      ) : (
        /* View: Projects Grid */
        loading ? (
          <div className="empty-loading-state">Loading submitted projects...</div>
        ) : projects.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <FolderGit2 size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
            <h3 style={{ marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
              {searchQuery || selectedTrackId ? 'No projects match your filter' : 'No projects submitted yet'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', fontSize: '0.88rem' }}>
              {searchQuery || selectedTrackId
                ? 'Try clearing your search keyword or switching track filters to explore more projects.'
                : 'Projects will appear here after participants submit their projects to this hackathon.'}
            </p>
            {(searchQuery || selectedTrackId) && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleClearFilters}
                style={{ marginTop: '1rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="cards-grid">
            {projects.map((proj) => {
              const hasVoted = userVotes.has(proj._id.toString());
              return (
                <div key={proj._id} className="project-card">
                  <div className="project-card-header">
                    <span className="badge-tag badge-submitted">
                      <CheckCircle2 size={12} />
                      <span>SUBMITTED</span>
                    </span>
                    {(proj.trackId?.name || proj.track) && (
                      <span className="badge-tag" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                        {proj.trackId?.name || proj.track}
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
                    {(proj.teamId || proj.team) && (
                      <div className="meta-line">
                        <Users size={13} color="#34d399" />
                        <span><strong>Team:</strong> {proj.teamId?.name || proj.team}</span>
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

                    {votingStatus?.isOpen && (
                      <button
                        type="button"
                        className={hasVoted ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                        onClick={() => handleVoteToggle(proj._id)}
                        title={hasVoted ? 'Retract community vote' : 'Cast community vote'}
                      >
                        <ThumbsUp size={13} fill={hasVoted ? '#fff' : 'none'} />
                        <span>{hasVoted ? 'Voted' : 'Vote'}</span>
                      </button>
                    )}

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
              );
            })}
          </div>
        )
      )}

      {/* Project Details Modal */}
      <ProjectDetailModal
        project={selectedProject}
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        onVoteToggle={votingStatus?.isOpen ? handleVoteToggle : null}
        userHasVoted={selectedProject ? userVotes.has(selectedProject._id.toString()) : false}
        votingOpen={votingStatus?.isOpen}
      />
    </div>
  );
}
