import React, { useState, useEffect } from 'react';
import { X, FolderGit2, Calendar, Award, Users, ExternalLink, CheckCircle2, MessageSquare, ThumbsUp, Trash2, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProjectDetailModal({ project, isOpen, onClose, onVoteToggle, userHasVoted, votingOpen }) {
  const { currentUser, sessionToken } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [voteLoading, setVoteLoading] = useState(false);

  const eventId = typeof project?.eventId === 'object' ? project?.eventId?._id : project?.eventId;

  const fetchComments = async () => {
    if (!project?._id || !eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/projects/${project._id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch {
      // offline / quiet fallback
    }
  };

  useEffect(() => {
    if (isOpen && project?._id && eventId) {
      fetchComments();
      setNewComment('');
      setCommentError('');
    }
  }, [isOpen, project?._id, eventId]);

  if (!isOpen || !project) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!sessionToken) {
      setCommentError('Please log in to leave a comment.');
      return;
    }

    setCommentLoading(true);
    setCommentError('');

    try {
      const res = await fetch(`/api/events/${eventId}/projects/${project._id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setNewComment('');
        fetchComments();
      } else {
        setCommentError(data.message || data.error || 'Failed to submit comment');
      }
    } catch {
      setCommentError('Network error while posting comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!sessionToken || !confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c._id !== commentId));
      }
    } catch {
      // ignore
    }
  };

  const handleVoteClick = async () => {
    if (!onVoteToggle) return;
    setVoteLoading(true);
    try {
      await onVoteToggle(project._id);
    } finally {
      setVoteLoading(false);
    }
  };

  const canDeleteComment = (c) => {
    if (!currentUser) return false;
    const isAuthor = c.author?._id === currentUser._id;
    const isStaff = ['organizer', 'admin'].includes(currentUser.role);
    return isAuthor || isStaff;
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

          {/* Community Voting Action */}
          {votingOpen && onVoteToggle && (
            <div className="detail-section" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                    Community Voting
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {userHasVoted ? 'You have voted for this project.' : 'Vote to support this project in the community choice award.'}
                  </p>
                </div>
                <button
                  type="button"
                  className={userHasVoted ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                  onClick={handleVoteClick}
                  disabled={voteLoading || !sessionToken}
                >
                  <ThumbsUp size={14} fill={userHasVoted ? '#818cf8' : 'none'} />
                  <span>{userHasVoted ? 'Retract Vote' : 'Cast Vote'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="detail-section" style={{ marginTop: '1.75rem' }}>
            <h3 className="section-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <MessageSquare size={16} color="#818cf8" />
              <span>Project Comments ({comments.length})</span>
            </h3>

            {/* Comment Submission Form */}
            {sessionToken ? (
              <form onSubmit={handleAddComment} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <textarea
                    rows={2}
                    className="form-input"
                    placeholder="Leave constructive feedback or congratulations..."
                    value={newComment}
                    maxLength={1000}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={commentLoading || !newComment.trim()}
                    style={{ alignSelf: 'flex-end', padding: '0.65rem 1rem' }}
                  >
                    <Send size={14} />
                    <span>Post</span>
                  </button>
                </div>
                {commentError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    <AlertCircle size={14} />
                    <span>{commentError}</span>
                  </div>
                )}
              </form>
            ) : (
              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Please log in to join the conversation and leave a comment.
              </div>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No comments yet. Be the first to leave feedback!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {comments.map((c) => (
                  <div
                    key={c._id}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>
                          {c.author?.email || 'Participant'}
                        </span>
                        {c.author?.role && c.author.role !== 'participant' && (
                          <span className="badge-tag" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                            {c.author.role.toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatDate(c.createdAt)}
                        </span>
                      </div>
                      {canDeleteComment(c) && (
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteComment(c._id)}
                          title="Delete comment"
                          style={{ padding: '4px', color: '#94a3b8' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

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
