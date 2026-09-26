import React, { useState, useEffect } from 'react';
import { FolderGit2, Calendar, Users, ExternalLink } from 'lucide-react';

export default function OrganizerSubmissionsView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, []);

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Event Submissions</h1>
          <p className="page-description">Review all explicitly submitted hackathon projects.</p>
        </div>
        <span className="badge-tag badge-submitted">
          {projects.length} {projects.length === 1 ? 'Submission' : 'Submissions'}
        </span>
      </div>

      {loading ? (
        <div className="empty-loading-state">Loading submissions...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state-card">
          <p>No project submissions received yet.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {projects.map((proj) => (
            <div key={proj._id} className="project-card">
              <div className="project-card-header">
                <span className="badge-tag badge-submitted">SUBMITTED</span>
                {proj.trackId?.name && (
                  <span className="badge-tag" style={{ color: '#f59e0b' }}>{proj.trackId.name}</span>
                )}
              </div>

              <h3 className="project-card-title">{proj.title}</h3>
              <p className="project-card-desc">{proj.description}</p>

              <div className="project-card-meta">
                <div className="meta-line">
                  <Calendar size={13} color="#818cf8" />
                  <span>{proj.eventId?.name || 'Event'}</span>
                </div>
                {proj.teamId && (
                  <div className="meta-line">
                    <Users size={13} color="#34d399" />
                    <span>Team: {proj.teamId.name}</span>
                  </div>
                )}
              </div>

              {proj.repositoryUrl && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <a
                    href={proj.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn"
                    style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <ExternalLink size={12} />
                    <span>View Repository</span>
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
