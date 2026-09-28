import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectDetailModal from '../components/ProjectDetailModal';
import { getFriendlyErrorMessage } from '../utils/formatters';
import {
  Award,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  FileText,
  Search,
  Check
} from 'lucide-react';

const RUBRIC_CRITERIA = [
  {
    id: 'technicalInnovation',
    name: 'Technical Innovation & Architecture',
    description: 'Novelty of the approach, sound architectural patterns, code quality, and self-hosted reliability.',
    weight: 0.25,
    weightLabel: '25%'
  },
  {
    id: 'execution',
    name: 'Execution & Completeness',
    description: 'Functionality, adherence to project goals, stability, and lack of critical bugs.',
    weight: 0.25,
    weightLabel: '25%'
  },
  {
    id: 'design',
    name: 'Design, Usability & Polish',
    description: 'Visual appeal, responsive interface, clarity of user flows, and accessibility.',
    weight: 0.20,
    weightLabel: '20%'
  },
  {
    id: 'impact',
    name: 'Impact & Practicality',
    description: 'Real-world problem-solving value, offline utility, and deployment feasibility.',
    weight: 0.20,
    weightLabel: '20%'
  },
  {
    id: 'documentation',
    name: 'Documentation & Demonstration',
    description: 'Clear README, architecture diagrams, data models, and video demonstration.',
    weight: 0.10,
    weightLabel: '10%'
  }
];

function computeWeightedScore(criteria) {
  const tech = Number(criteria.technicalInnovation ?? 0);
  const exec = Number(criteria.execution ?? 0);
  const des = Number(criteria.design ?? 0);
  const imp = Number(criteria.impact ?? 0);
  const doc = Number(criteria.documentation ?? 0);

  const weighted = (tech * 2.5) + (exec * 2.5) + (des * 2.0) + (imp * 2.0) + (doc * 1.0);
  return Math.round(weighted * 10) / 10;
}

export default function JudgeDashboard({ onOpenAuth }) {
  const { currentUser, sessionToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState({ totalAssigned: 0, completedCount: 0, remainingCount: 0, progressPercentage: 0 });
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'completed'

  // Review screen state
  const [activeProject, setActiveProject] = useState(null);
  const [formCriteria, setFormCriteria] = useState({});
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedModalProject, setSelectedModalProject] = useState(null);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json'
  }), [sessionToken]);

  const loadJudgingData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/judge/projects', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load assigned projects.');
      setEvent(data.event);
      setStats(data.stats || { totalAssigned: 0, completedCount: 0, remainingCount: 0, progressPercentage: 0 });
      setProjects(data.projects || []);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not load assigned projects.'));
    } finally {
      setLoading(false);
    }
  }, [headers, sessionToken]);

  useEffect(() => {
    if (currentUser?.role === 'judge' || currentUser?.role === 'admin') {
      loadJudgingData();
    }
  }, [currentUser, loadJudgingData]);

  // Start or edit review for a project
  const openReviewScreen = (project) => {
    setActiveProject(project);
    setError('');
    setNotice('');
    setConfirmModalOpen(false);

    if (project.myScore && project.myScore.criteria) {
      const c = project.myScore.criteria;
      setFormCriteria({
        technicalInnovation: c.technicalInnovation ?? c.innovation ?? 5,
        execution: c.execution ?? c.functionality ?? 5,
        design: c.design ?? c.quality ?? 5,
        impact: c.impact ?? 5,
        documentation: c.documentation ?? 5
      });
      setFormComment(project.myScore.comment || '');
    } else {
      // Default initial score selection
      setFormCriteria({
        technicalInnovation: 7,
        execution: 7,
        design: 7,
        impact: 7,
        documentation: 7
      });
      setFormComment('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeReviewScreen = () => {
    setActiveProject(null);
    setConfirmModalOpen(false);
    setError('');
  };

  const handleScoreChange = (criterionId, val) => {
    setFormCriteria(prev => ({
      ...prev,
      [criterionId]: Number(val)
    }));
  };

  // Accidental submission confirmation step
  const openConfirmModal = (e) => {
    e.preventDefault();
    setError('');

    // Verify all 5 criteria are answered
    for (const c of RUBRIC_CRITERIA) {
      const val = formCriteria[c.id];
      if (typeof val !== 'number' || val < 1 || val > 10) {
        setError(`Please select a score between 1 and 10 for ${c.name}.`);
        return;
      }
    }

    setConfirmModalOpen(true);
  };

  // Submit final review
  const handleFinalSubmit = async () => {
    if (!activeProject) return;
    setSubmitting(true);
    setError('');

    const body = {
      projectId: activeProject._id,
      eventId: event?._id,
      criteria: formCriteria,
      comment: formComment
    };

    try {
      let res;
      if (activeProject.myScore?._id) {
        // Update existing review
        res = await fetch(`/api/judge/scores/${activeProject.myScore._id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });
      } else {
        // Create new review
        res = await fetch('/api/judge/scores', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not submit review.');

      setNotice('Review submitted. Your evaluation has been recorded.');
      setConfirmModalOpen(false);
      setActiveProject(null);
      await loadJudgingData();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not submit review. Please try again.'));
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const nextReviewProject = useMemo(() => {
    return projects.find(p => !p.isReviewed);
  }, [projects]);

  const currentWeightedTotal = useMemo(() => {
    return computeWeightedScore(formCriteria);
  }, [formCriteria]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = !search.trim() ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.track?.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.team?.name?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && p.isReviewed) ||
        (statusFilter === 'pending' && !p.isReviewed);

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  if (!currentUser || (currentUser.role !== 'judge' && currentUser.role !== 'admin')) {
    return (
      <div className="empty-state-card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
        <Award size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h2>Judge Access Required</h2>
        <p>You must be signed in with a Judge or Admin account to access the evaluation portal.</p>
        <button className="btn-primary" onClick={() => onOpenAuth('login')} style={{ marginTop: '1.25rem' }}>
          Sign In as Judge
        </button>
      </div>
    );
  }

  // ==========================================
  // VIEW: FOCUSED JUDGE REVIEW SCREEN
  // ==========================================
  if (activeProject) {
    return (
      <div className="page-view-container judge-review-page" style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <button className="text-button" onClick={closeReviewScreen} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back to My Judging
          </button>
          <span className="badge-tag" style={{ color: activeProject.isReviewed ? '#10b981' : '#f59e0b', borderColor: 'currentColor' }}>
            {activeProject.isReviewed ? 'Editing Existing Review' : 'New Review'}
          </span>
        </div>

        {error && (
          <div className="event-date-error" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Project Header Banner */}
        <section className="workspace-card" style={{ marginBottom: '1.5rem' }}>
          <p className="organizer-eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Evaluation · {event?.name || 'Hackathon Event'}
          </p>
          <h1 className="page-title" style={{ fontSize: '1.6rem', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
            {activeProject.title}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            <span>Team: <strong>{activeProject.team?.name || 'Independent'}</strong></span>
            <span>·</span>
            <span>Track: <strong style={{ color: '#4D2FF9' }}>{activeProject.track?.name || 'General Track'}</strong></span>
          </div>

          {activeProject.description && (
            <p style={{ marginTop: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>
              {activeProject.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
            {activeProject.repositoryUrl && (
              <a
                href={activeProject.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ExternalLink size={14} /> View Repository
              </a>
            )}
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setSelectedModalProject(activeProject)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FileText size={14} /> View Submission Details
            </button>
          </div>
        </section>

        {/* Live Score Sticky Summary */}
        <div
          className="workspace-card"
          style={{
            position: 'sticky',
            top: '1rem',
            zIndex: 10,
            marginBottom: '1.5rem',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(77, 47, 249, 0.24)',
            boxShadow: '0 8px 24px rgba(77, 47, 249, 0.1)',
            padding: '1rem 1.25rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Your Weighted Evaluation Score
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 700, color: '#4D2FF9' }}>
                  {currentWeightedTotal}
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={openConfirmModal}
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Review & Submit <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Rubric Evaluation Form */}
        <form onSubmit={openConfirmModal}>
          <div style={{ display: 'grid', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {RUBRIC_CRITERIA.map((criterion, idx) => {
              const currentVal = formCriteria[criterion.id] ?? 0;
              return (
                <div key={criterion.id} className="workspace-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                        {idx + 1}. {criterion.name}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.65rem' }}>
                        {criterion.description}
                      </p>
                    </div>
                    <span
                      className="badge-tag"
                      style={{
                        flex: '0 0 auto',
                        fontWeight: 600,
                        color: '#4D2FF9',
                        background: 'rgba(77, 47, 249, 0.08)',
                        borderColor: 'rgba(77, 47, 249, 0.2)'
                      }}
                    >
                      Weight: {criterion.weightLabel}
                    </span>
                  </div>

                  {/* 1-10 Pill Selector */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>1 (Poor)</span>
                      <span>5 (Acceptable)</span>
                      <span>10 (Outstanding)</span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(10, 1fr)',
                        gap: '0.35rem'
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                        const isSelected = currentVal === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleScoreChange(criterion.id, val)}
                            style={{
                              padding: '0.6rem 0',
                              textAlign: 'center',
                              fontSize: '0.9rem',
                              fontWeight: isSelected ? '700' : '500',
                              color: isSelected ? '#ffffff' : 'var(--text-primary)',
                              background: isSelected ? '#4D2FF9' : 'rgba(255, 255, 255, 0.8)',
                              border: isSelected ? '1px solid #4D2FF9' : '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 3px 8px rgba(77, 47, 249, 0.25)' : 'none'
                            }}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feedback & Comments */}
          <div className="workspace-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <label className="form-group" style={{ margin: 0 }}>
              <span className="form-label" style={{ fontWeight: 650 }}>
                Evaluation Notes & Feedback (Optional)
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
                Provide qualitative comments or constructive suggestions for the team and organizers.
              </p>
              <textarea
                className="form-input form-textarea"
                rows={3}
                placeholder="Share constructive feedback on architecture, execution, or presentation..."
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
              />
            </label>
          </div>

          {/* Bottom Submission Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '3rem' }}>
            <button type="button" className="btn-secondary" onClick={closeReviewScreen}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
              Review Evaluation Summary <ChevronRight size={16} />
            </button>
          </div>
        </form>

        {/* Accidental Submission Prevention Modal */}
        {confirmModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '520px', padding: '1.75rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(77, 47, 249, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
                  <Award size={26} color="#4D2FF9" />
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Review Evaluation Summary
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Confirm your evaluation scores for <strong>{activeProject.title}</strong> before recording.
                </p>
              </div>

              {/* Breakdown List */}
              <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
                {RUBRIC_CRITERIA.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.86rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formCriteria[c.id] || 0} / 10</strong>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.65rem', marginTop: '0.4rem', borderTop: '2px solid var(--border-subtle)', fontSize: '0.95rem' }}>
                  <strong>Weighted Total Score:</strong>
                  <strong style={{ color: '#4D2FF9', fontSize: '1.15rem' }}>{currentWeightedTotal} / 100</strong>
                </div>
              </div>

              {formComment && (
                <div style={{ marginBottom: '1.25rem', fontSize: '0.84rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Comments:</span>
                  <p style={{ margin: '0.25rem 0 0', fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{formComment}"</p>
                </div>
              )}

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem', textAlign: 'center' }}>
                Your scores will be safely recorded. Only you can view your private score sheet.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                >
                  Back to Review
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ProjectDetailModal
          project={selectedModalProject}
          isOpen={Boolean(selectedModalProject)}
          onClose={() => setSelectedModalProject(null)}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN JUDGE DASHBOARD
  // ==========================================
  return (
    <div className="page-view-container judge-dashboard-view">
      {/* ORIENTATION BLOCK: Answers Where am I? What can I do? What needs attention? What happens next? */}
      <header className="page-header-block">
        <div className="page-title-group">
          <p className="organizer-eyebrow">Judge Evaluation Console</p>
          <h1 className="page-title">Judging</h1>
          <p className="page-description">
            {event?.name
              ? `Assigned event: ${event.name}. Score submissions across technical innovation, execution, design, impact, and documentation.`
              : 'Evaluate assigned hackathon submissions against the standardized 5-criterion rubric.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <div className="badge-tag" style={{ color: '#4D2FF9', borderColor: 'rgba(77, 47, 249, 0.3)', background: 'rgba(77, 47, 249, 0.08)' }}>
            Judge: {currentUser.email}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Peer scores remain isolated and confidential
          </span>
        </div>
      </header>

      {notice && (
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#065f46', padding: '0.85rem 1.15rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={16} /> {notice}
        </div>
      )}

      {error && (
        <div className="event-date-error" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* 1-CLICK NEXT REVIEW ACTION: Immediate access for first-time or returning judge */}
      {nextReviewProject && (
        <section
          className="workspace-card"
          style={{
            background: 'linear-gradient(135deg, rgba(77, 47, 249, 0.08), rgba(86, 103, 255, 0.12))',
            border: '1px solid rgba(77, 47, 249, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span className="badge-tag" style={{ background: '#4D2FF9', color: '#ffffff', border: 'none', fontSize: '0.74rem', fontWeight: 600 }}>
                Next Up for Evaluation
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {stats.remainingCount} review{stats.remainingCount === 1 ? '' : 's'} remaining
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.2rem 0', color: 'var(--text-primary)' }}>
              {nextReviewProject.title}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
              Track: <strong>{nextReviewProject.track?.name || 'General'}</strong> &bull; Team: <strong>{nextReviewProject.team?.name || 'Independent'}</strong>
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openReviewScreen(nextReviewProject)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>Review Next Project</span>
            <ChevronRight size={18} />
          </button>
        </section>
      )}

      {/* ALL REVIEWS COMPLETED NOTICE */}
      {!nextReviewProject && projects.length > 0 && (
        <section
          className="workspace-card"
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.35rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <CheckCircle2 size={28} color="#10b981" style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 650, color: '#065f46' }}>
              All Assigned Evaluations Complete!
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              You have evaluated all {projects.length} assigned projects. You can adjust your scores below at any time before judging closes.
            </p>
          </div>
        </section>
      )}

      {/* MY JUDGING OVERVIEW HERO CARD (Section 2) */}
      <section className="workspace-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 650, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Evaluation Progress
        </h2>

        {/* 4 Stats Grid */}
        <div className="metrics-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="metric-card">
            <div className="metric-label">Assigned Projects</div>
            <div className="metric-value">{stats.totalAssigned}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label" style={{ color: '#10b981' }}>Completed</div>
            <div className="metric-value" style={{ color: '#10b981' }}>{stats.completedCount}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label" style={{ color: stats.remainingCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
              Remaining
            </div>
            <div className="metric-value" style={{ color: stats.remainingCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
              {stats.remainingCount}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Progress</div>
            <div className="metric-value" style={{ color: '#4D2FF9' }}>{stats.progressPercentage}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            <span>{stats.completedCount} of {stats.totalAssigned} completed</span>
            <span>{stats.progressPercentage}%</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.06)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${stats.progressPercentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #5667FF, #4D2FF9)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      </section>

      {/* FILTER & SEARCH TOOLBAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px' }}>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search assigned projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className={`btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            className={`btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending ({stats.remainingCount})
          </button>
          <button
            type="button"
            className={`btn-sm ${statusFilter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({stats.completedCount})
          </button>
        </div>
      </div>

      {/* ASSIGNED PROJECTS TABLE / CARDS */}
      {loading ? (
        <div className="empty-loading-state">Loading assigned projects…</div>
      ) : filteredProjects.length === 0 ? (
        <div className="workspace-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Award size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {projects.length === 0 ? 'No projects submitted yet' : 'No projects match your filter'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
            {projects.length === 0
              ? 'Projects will appear here after participants submit their projects and the organizer assigns tracks to you.'
              : 'Try changing your search keywords or switching between All, Pending, and Completed filters.'}
          </p>
          {filteredProjects.length === 0 && projects.length > 0 && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              style={{ marginTop: '1rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {filteredProjects.map(project => {
            const isDone = project.isReviewed;
            return (
              <article
                key={project._id}
                className="workspace-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1.15rem 1.35rem',
                  borderLeft: isDone ? '4px solid #10b981' : '4px solid #f59e0b'
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                      {project.title}
                    </h3>
                    {project.track && (
                      <span className="badge-tag" style={{ color: '#4D2FF9', fontSize: '0.74rem' }}>
                        {project.track.name}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: '0.2rem 0', color: 'var(--text-secondary)', fontSize: '0.83rem' }}>
                    Team: {project.team?.name || 'Independent'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {isDone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontWeight: 600 }}>
                        <CheckCircle2 size={13} /> Completed · Your Score: {project.myScore?.weightedScore || project.myScore?.rawTotal}/100
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', fontWeight: 600 }}>
                        <Clock size={13} /> Remaining Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Normal Language Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setSelectedModalProject(project)}
                  >
                    View Submission
                  </button>
                  <button
                    type="button"
                    className={isDone ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                    onClick={() => openReviewScreen(project)}
                  >
                    {isDone ? 'Continue' : 'Start Review'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ProjectDetailModal
        project={selectedModalProject}
        isOpen={Boolean(selectedModalProject)}
        onClose={() => setSelectedModalProject(null)}
      />
    </div>
  );
}
