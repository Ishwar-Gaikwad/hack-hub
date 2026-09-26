import React from 'react';
import { X, FolderGit2, Calendar, Award, Users, ExternalLink, CheckCircle2 } from 'lucide-react';

export default function ProjectDetailModal({ project, isOpen, onClose }) {
  if (!isOpen || !project) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className="badge-tag badge-submitted">
                <CheckCircle2 size={12} />
                <span>SUBMITTED PROJECT</span>
              </span>
              {project.createdAt && (
                <span className="text-muted-xs">
                  Submitted {formatDate(project.createdAt)}
                </span>
              )}
            </div>
            <h2 className="modal-title">{project.title}</h2>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-content">
          {/* Main Description */}
          <div className="project-description-box">
            <h3 className="section-subtitle" style={{ marginBottom: '0.5rem' }}>
              Overview & Solution
            </h3>
            <p className="project-full-text">
              {project.description || 'No detailed description provided.'}
            </p>
          </div>

          {/* Metadata Cards */}
          <div className="metrics-grid" style={{ marginTop: '1.25rem' }}>
            <div className="metric-card">
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#818cf8" /> Event
              </div>
              <div className="metric-value" style={{ fontSize: '0.95rem' }}>
                {project.eventId?.name || 'Hackathon Event'}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={14} color="#f59e0b" /> Track
              </div>
              <div className="metric-value" style={{ fontSize: '0.95rem' }}>
                {project.trackId?.name || 'General Track'}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} color="#34d399" /> Team
              </div>
              <div className="metric-value" style={{ fontSize: '0.95rem' }}>
                {project.teamId?.name || 'Collaborative Team'}
              </div>
            </div>
          </div>

          {/* Links & Resources */}
          {project.repositoryUrl && (
            <div className="detail-section" style={{ marginTop: '1.5rem' }}>
              <h3 className="section-subtitle" style={{ marginBottom: '0.5rem' }}>
                <FolderGit2 size={16} color="#6366f1" />
                <span>Project Code Repository</span>
              </h3>
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="repo-link-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FolderGit2 size={20} color="#818cf8" />
                  <div>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                      {project.repositoryUrl}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Open external repository in new tab
                    </div>
                  </div>
                </div>
                <ExternalLink size={16} color="var(--text-muted)" />
              </a>
            </div>
          )}

          {/* Modal Actions */}
          <div className="modal-actions-footer">
            <button className="btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
