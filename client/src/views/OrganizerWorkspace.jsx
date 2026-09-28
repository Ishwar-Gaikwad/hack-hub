import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectDetailModal from '../components/ProjectDetailModal';
import { ArrowLeft, CalendarDays, Download, Pencil, Plus, Save, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'judges', label: 'Judges' },
  { id: 'judging', label: 'Judging' },
  { id: 'results', label: 'Results' },
  { id: 'settings', label: 'Settings' }
];
const idOf = (value) => String(value?._id || value || '');
const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const dateTime = (value) => value ? new Date(value).toLocaleString() : 'Not set';

const formatCriterion = (key) => {
  const map = {
    technicalInnovation: 'Technical Innovation',
    execution: 'Execution',
    design: 'Design',
    impact: 'Impact',
    documentation: 'Documentation',
    functionality: 'Functionality',
    quality: 'Quality',
    innovation: 'Innovation'
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
};

const formatAuditAction = (action) => {
  const map = {
    'review.submitted': 'Review submitted',
    'review.updated': 'Review updated',
    'assignment.created': 'Assignment created',
    'score.flagged': 'Score flagged',
    'result.published': 'Result published'
  };
  return map[action] || action;
};

export default function OrganizerWorkspace({ eventId: initialEventId, initialTab = 'overview', initialNotice = '', onNavigate }) {
  const { currentUser, sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(initialEventId || '');
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [projects, setProjects] = useState([]);
  const [eventProjects, setEventProjects] = useState([]);
  const [scores, setScores] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [results, setResults] = useState(null);
  const [voting, setVoting] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [eventForm, setEventForm] = useState(null);
  const [votingForm, setVotingForm] = useState({ votingOpenAt: '', votingCloseAt: '' });
  const votingOpenInput = useRef(null);
  const votingCloseInput = useRef(null);
  const [itemForm, setItemForm] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  const [error, setError] = useState('');
  const [judgingOverview, setJudgingOverview] = useState(null);
  const [judgingLoading, setJudgingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' }), [sessionToken]);
  const navigateTab = (nextTab) => {
    setTab(nextTab);
    onNavigate('event-workspace', { eventId, tab: nextTab.toLowerCase() });
  };
  const ownEvents = useCallback((list) => {
    const userId = idOf(currentUser);
    return (list || []).filter((item) => idOf(item.createdBy) === userId);
  }, [currentUser]);

  useEffect(() => {
    let alive = true;
    fetch('/api/events').then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load your hackathons.');
      if (alive) setEvents(ownEvents(data.events));
    }).catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [ownEvents]);

  useEffect(() => { if (initialEventId) setEventId(initialEventId); }, [initialEventId]);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialNotice) setNotice(initialNotice); }, [initialNotice]);
  useEffect(() => {
    setEvent(null);
    setMetrics(null);
    setScores([]);
    setProjects([]);
    setEventProjects([]);
    setResults(null);
    setVoting(null);
    setJudgingOverview(null);
    setError('');
  }, [eventId]);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load this hackathon.');
      if (idOf(data.event.createdBy) !== idOf(currentUser)) throw new Error('This hackathon is not in your organizer account.');
      setEvent(data.event);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [eventId, currentUser]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => {
    if (event) setVotingForm({ votingOpenAt: localDateTime(event.votingOpenAt), votingCloseAt: localDateTime(event.votingCloseAt) });
  }, [event]);

  const loadSubmissions = useCallback(async () => {
    if (!eventId) return;
    setSubmissionsLoading(true);
    const params = new URLSearchParams({ eventId });
    if (search.trim()) params.set('q', search.trim());
    try {
      const response = await fetch(`/api/projects?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load submissions.');
      setProjects(data.projects || []);
    } finally { setSubmissionsLoading(false); }
  }, [eventId, search]);

  const loadMetricsAndScores = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    setAnalyticsLoading(true);
    try {
      const [metricResponse, scoreResponse, projectResponse] = await Promise.all([
        fetch(`/api/events/${eventId}/metrics`, { headers }),
        fetch('/api/judge/scores', { headers }),
        fetch(`/api/events/${eventId}/projects`)
      ]);
      const [metricData, scoreData, projectData] = await Promise.all([metricResponse.json(), scoreResponse.json(), projectResponse.json()]);
      if (!metricResponse.ok) throw new Error(metricData.message || 'Could not load event metrics.');
      if (!scoreResponse.ok) throw new Error(scoreData.message || 'Could not load judging activity.');
      if (!projectResponse.ok) throw new Error(projectData.message || 'Could not load submitted projects.');
      setMetrics(metricData);
      const submittedProjects = projectData.projects || [];
      setEventProjects(submittedProjects);
      const eventProjectIds = new Set(submittedProjects.map((project) => idOf(project)));
      setScores((scoreData.scores || []).filter((score) => eventProjectIds.has(idOf(score.projectId))));
    } finally { setAnalyticsLoading(false); }
  }, [eventId, headers, sessionToken]);

  const loadResults = useCallback(async () => {
    if (!eventId) return;
    setResultsLoading(true);
    try {
      const [resultResponse, votingResponse] = await Promise.all([
        fetch(`/api/events/${eventId}/results`, { headers }),
        fetch(`/api/events/${eventId}/voting`, { headers })
      ]);
      const [resultData, votingData] = await Promise.all([resultResponse.json(), votingResponse.json()]);
      if (!resultResponse.ok) throw new Error(resultData.message || 'Could not load community results.');
      if (!votingResponse.ok) throw new Error(votingData.message || 'Could not load voting status.');
      setResults(resultData);
      setVoting(votingData);
    } finally { setResultsLoading(false); }
  }, [eventId, headers]);

  const loadJudgingOverview = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    setJudgingLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/judging/overview`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load judging overview.');
      setJudgingOverview(data);
    } catch (err) { setError(err.message); }
    finally { setJudgingLoading(false); }
  }, [eventId, headers, sessionToken]);

  useEffect(() => {
    if (!eventId) return;
    loadMetricsAndScores().catch((err) => setError(err.message));
  }, [eventId, loadMetricsAndScores]);
  useEffect(() => {
    if (tab.toLowerCase() === 'submissions') loadSubmissions().catch((err) => setError(err.message));
  }, [tab, loadSubmissions]);
  useEffect(() => {
    if (tab.toLowerCase() === 'results') loadResults().catch((err) => setError(err.message));
  }, [tab, loadResults]);
  useEffect(() => {
    if (tab.toLowerCase() === 'judging') loadJudgingOverview().catch((err) => setError(err.message));
  }, [tab, loadJudgingOverview]);

  const reviewedProjects = new Set(scores.map((score) => idOf(score.projectId)).filter(Boolean));
  const scoredJudges = useMemo(() => {
    const judges = new Map();
    scores.forEach((score) => {
      const judgeId = idOf(score.judgeId);
      if (!judgeId) return;
      const judge = judges.get(judgeId) || { id: judgeId, email: score.judgeId?.email || 'Judge', reviews: 0 };
      judge.reviews += 1;
      judges.set(judgeId, judge);
    });
    return [...judges.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [scores]);

  const downloadCsv = async (type = 'projects') => {
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}/export/csv?type=${type}`, { headers: { Authorization: `Bearer ${sessionToken}` } });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'CSV export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `event-${eventId}-${type}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  const saveEvent = async (e) => {
    e.preventDefault();
    setError('');
    const body = { ...eventForm };
    ['startDate', 'submissionDeadline', 'endDate'].forEach((key) => { body[key] = new Date(body[key]).toISOString(); });
    if (new Date(body.startDate) > new Date(body.submissionDeadline) || new Date(body.submissionDeadline) > new Date(body.endDate)) {
      setError('Dates must be ordered: start, submission deadline, then end.'); return;
    }
    const response = await fetch(`/api/events/${eventId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.message || 'Could not update hackathon.'); return; }
    setEventForm(null);
    await loadEvent();
    setNotice('Hackathon details saved.');
  };

  const saveVotingWindow = async (e) => {
    e.preventDefault();
    if (votingForm.votingOpenAt && votingForm.votingCloseAt && new Date(votingForm.votingCloseAt) <= new Date(votingForm.votingOpenAt)) {
      setError('Voting must close after it opens.');
      return;
    }
    setError('');
    const response = await fetch(`/api/events/${eventId}/voting`, { method: 'PUT', headers, body: JSON.stringify({ votingOpenAt: votingForm.votingOpenAt ? new Date(votingForm.votingOpenAt).toISOString() : null, votingCloseAt: votingForm.votingCloseAt ? new Date(votingForm.votingCloseAt).toISOString() : null }) });
    const data = await response.json();
    if (!response.ok) { setError(data.message || 'Could not update voting schedule.'); return; }
    setNotice('Voting schedule saved.');
    await loadEvent();
    if (tab.toLowerCase() === 'results') await loadResults();
  };

  const openEventForm = () => setEventForm({ name: event.name || '', description: event.description || '', startDate: localDateTime(event.startDate), submissionDeadline: localDateTime(event.submissionDeadline), endDate: localDateTime(event.endDate), status: event.status });
  const startItemEdit = (kind, item = null) => setItemForm({ kind, id: item?._id || '', name: item?.name || '', description: item?.description || '', value: item?.value || '' });
  const saveItem = async (e) => {
    e.preventDefault();
    const { kind, id, name, description, value } = itemForm;
    const body = { name: name.trim(), description: description.trim() };
    if (kind === 'prizes') body.value = value.trim();
    const response = await fetch(`/api/events/${eventId}/${kind}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.message || `Could not save ${kind === 'tracks' ? 'track' : 'prize'}.`); return; }
    setItemForm(null);
    setNotice(`${kind === 'tracks' ? 'Track' : 'Prize'} saved.`);
    await loadEvent();
  };
  const renderItemForm = () => itemForm && <form className="organizer-edit-form organizer-item-form" onSubmit={saveItem}><h3>{itemForm.id ? 'Edit' : 'Add'} {itemForm.kind === 'tracks' ? 'track' : 'prize'}</h3><label className="form-group"><span className="form-label">Name</span><input className="form-input" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} minLength={2} required /></label>{itemForm.kind === 'prizes' && <label className="form-group"><span className="form-label">Value</span><input className="form-input" value={itemForm.value} onChange={(e) => setItemForm({ ...itemForm, value: e.target.value })} /></label>}<label className="form-group"><span className="form-label">Description</span><input className="form-input" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></label><div className="organizer-inline-actions"><button className="btn-primary btn-sm">Save</button><button type="button" className="btn-secondary btn-sm" onClick={() => setItemForm(null)}>Cancel</button></div></form>;

  if (!eventId) return <div className="page-view-container organizer-page">
    <button className="text-button" onClick={() => onNavigate('my-events')}><ArrowLeft size={15} /> My Hackathons</button>
    <h1 className="page-title">Choose a hackathon</h1>
    {ownEvents(events).map((item) => <button className="organizer-event-row" key={item._id} onClick={() => setEventId(item._id)}><span><strong>{item.name}</strong><small>{eventDateRange(item)}</small></span><span className={`organizer-status status-${item.status}`}>{item.status}</span></button>)}
  </div>;

  if (loading && !event) return <div className="page-view-container empty-loading-state">Loading hackathon…</div>;
  if (error && !event) return <div className="page-view-container"><div className="event-date-error" role="alert">{error}</div><button className="text-button" onClick={() => onNavigate('my-events')}>Back to My Hackathons</button></div>;
  if (!event) return null;

  return <div className="page-view-container organizer-workspace">
    <div className="workspace-event-heading">
      <div><button className="text-button" onClick={() => onNavigate('my-events')}><ArrowLeft size={15} /> My Hackathons</button><p className="organizer-eyebrow">Organizer · Hackathon</p><h1 className="page-title">{event.name}</h1></div>
      <span className={`organizer-status status-${event.status}`}>{event.status}</span>
    </div>
    <nav className="organizer-workspace-tabs" aria-label={`${event.name} management`}>
      {TABS.map((item) => <button key={item.id} className={tab.toLowerCase() === item.id ? 'active' : ''} aria-current={tab.toLowerCase() === item.id ? 'page' : undefined} onClick={() => { setTab(item.label); setError(''); setNotice(''); onNavigate('event-workspace', { eventId, tab: item.id }); }}>{item.label}</button>)}
    </nav>
    {(error || notice) && <p className={error ? 'event-date-error' : 'organizer-notice'} role={error ? 'alert' : 'status'}>{error || notice}</p>}

    {tab.toLowerCase() === 'overview' && <>
      <section className="workspace-card organizer-overview-panel">
        <div className="organizer-section-heading"><h2>Overview</h2><button className="btn-secondary btn-sm" onClick={() => { openEventForm(); navigateTab('Settings'); }}>Edit Event</button></div>
        <dl className="workspace-event-dates"><dt>Starts</dt><dd>{dateTime(event.startDate)}</dd><dt>Submission deadline</dt><dd>{dateTime(event.submissionDeadline)}</dd><dt>Ends</dt><dd>{dateTime(event.endDate)}</dd><dt>Tracks</dt><dd>{event.tracks?.length || 0}</dd><dt>Submitted projects</dt><dd>{metrics?.participation?.submittedProjects ?? 'Loading…'}</dd><dt>Judges with recorded reviews</dt><dd>{analyticsLoading ? 'Loading…' : scoredJudges.length}</dd><dt>Reviews recorded</dt><dd>{analyticsLoading ? 'Loading…' : scores.length}</dd></dl>
      </section>
      <section className="organizer-next-actions"><h2>Next actions</h2><div>
        {(!event.tracks?.length || !event.prizes?.length) && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Settings')}>Complete event setup</button>}
        {(metrics?.participation?.submittedProjects || 0) > 0 && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Judging')}>View review activity</button>}
        {event.submissionDeadline && Date.now() < new Date(event.submissionDeadline).getTime() && new Date(event.submissionDeadline).getTime() - Date.now() < 7 * 86400000 && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Submissions')}>Submission deadline approaching</button>}
        {!event.tracks?.length && !event.prizes?.length && !(metrics?.participation?.submittedProjects > 0) && <p className="text-muted-sm">No pending organizer actions.</p>}
      </div></section>
    </>}

    {tab.toLowerCase() === 'submissions' && <section className="organizer-section">
      <div className="organizer-section-heading"><h2>Submissions</h2><div className="organizer-inline-actions"><input className="form-input organizer-search" aria-label="Search submissions" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn-secondary btn-sm" onClick={() => downloadCsv('projects')}><Download size={14} /> Export projects CSV</button></div></div>
      {submissionsLoading ? <div className="empty-loading-state">Loading submissions…</div> : projects.length ? <div className="organizer-submission-list">{projects.map((project) => <article className="organizer-submission-row" key={project._id}>
        <div><span className="organizer-submission-status">Submitted</span><h3>{project.title}</h3><p>{project.teamId?.name || 'Team not provided'} · {project.trackId?.name || 'No track'}</p><small>Submitted {dateTime(project.updatedAt || project.createdAt)}</small></div>
        <button className="btn-secondary btn-sm" onClick={() => setSelectedProject(project)}>View Project</button>
      </article>)}</div> : <p className="organizer-empty-inline">No submitted projects for this hackathon.</p>}
    </section>}

    {tab.toLowerCase() === 'judges' && <section className="workspace-card organizer-info-panel"><h2>Judges</h2>{analyticsLoading ? <p>Loading judge activity…</p> : scoredJudges.length ? <><p>These judges have submitted at least one score for this hackathon.</p><div className="organizer-table"><div className="organizer-table-head"><span>Judge</span><span>Recorded reviews</span><span>Status</span></div>{scoredJudges.map((judge) => <div className="organizer-table-row" key={judge.id}><span>{judge.email}</span><span>{judge.reviews}</span><span>Active</span></div>)}</div></> : <p>No judges have recorded scores for this event yet.</p>}<p className="organizer-capability-note">Judge invitations and assignments are not supported by the current API.</p></section>}

    {tab.toLowerCase() === 'judging' && (
      <div className="judging-control-center">
        {/* Section Heading & Actions */}
        <section className="workspace-card organizer-info-panel">
          <div className="judging-section-heading">
            <div>
              <h2>Judging Control Center</h2>
              <p>Track real-time progress, review score discrepancies, and inspect normalized rankings.</p>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => downloadCsv('judging')}>
              <Download size={14} /> Export Judging CSV
            </button>
          </div>

          {judgingLoading ? (
            <div className="empty-loading-state">Loading judging control center…</div>
          ) : !judgingOverview ? (
            <p>No judging data available yet for this event.</p>
          ) : (
            <>
              {/* Progress Bar & KPIs */}
              <div className="judging-kpi-grid">
                <div className="judging-kpi-card">
                  <span className="judging-kpi-num">{judgingOverview.progress?.totalAssignments ?? 0}</span>
                  <span className="judging-kpi-label">Total assignments</span>
                </div>
                <div className="judging-kpi-card">
                  <span className="judging-kpi-num">{judgingOverview.progress?.completedReviews ?? 0}</span>
                  <span className="judging-kpi-label">Completed reviews</span>
                </div>
                <div className="judging-kpi-card">
                  <span className="judging-kpi-num">{judgingOverview.progress?.pendingReviews ?? 0}</span>
                  <span className="judging-kpi-label">Pending reviews</span>
                </div>
                <div className="judging-kpi-card">
                  <span className="judging-kpi-num">{judgingOverview.progress?.completionPercentage ?? 0}%</span>
                  <span className="judging-kpi-label">Completion rate</span>
                </div>
              </div>

              <div className="judging-progress-bar-container">
                <div className="judging-progress-meta">
                  <span>
                    <strong>{judgingOverview.progress?.completedReviews ?? 0}</strong> of{' '}
                    {judgingOverview.progress?.totalAssignments ?? 0} reviews completed
                  </span>
                  <span>
                    {judgingOverview.progress?.reviewedProjectsCount ?? 0} of{' '}
                    {judgingOverview.progress?.totalProjects ?? 0} submitted projects evaluated
                  </span>
                </div>
                <div className="judging-progress-track">
                  <div
                    className="judging-progress-fill"
                    style={{ width: `${judgingOverview.progress?.completionPercentage ?? 0}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {judgingOverview && (
          <>
            {/* Projects Requiring Attention */}
            <section className="workspace-card organizer-info-panel">
              <div className="judging-section-heading">
                <div>
                  <h2>Projects requiring attention</h2>
                  <p>Evaluations with large reviewer differences or insufficient review coverage.</p>
                </div>
              </div>

              <div className="judging-attention-container">
                {/* Discrepancies */}
                {judgingOverview.attention?.discrepancies?.map((item, idx) => (
                  <div key={`disc-${idx}`} className="judging-alert-card discrepancy-card">
                    <div className="judging-alert-header">
                      <h4>Project: {item.projectTitle} · {formatCriterion(item.criterion)}</h4>
                      <span className="judging-badge badge-warning">
                        ⚠ Review difference: {item.diff.toFixed(1)}
                      </span>
                    </div>
                    <div className="judging-comparison">
                      {item.scores.map((s, sIdx) => (
                        <span key={sIdx} className="judge-score-pill">
                          <strong>{s.judgeLabel}:</strong> {s.score}/10
                        </span>
                      ))}
                    </div>
                    <p className="judging-alert-hint">
                      Evaluations differ by {item.diff.toFixed(1)} points (threshold &gt; 2.0). Reviewers may have applied different standards.
                    </p>
                  </div>
                ))}

                {/* Insufficient reviews */}
                {judgingOverview.attention?.insufficientReviews?.map((item, idx) => (
                  <div key={`insuf-${idx}`} className="judging-alert-card insufficient-card">
                    <div className="judging-alert-header">
                      <h4>Project: {item.projectTitle}</h4>
                      <span className="judging-badge badge-info">Needs review</span>
                    </div>
                    <p className="judging-alert-hint">
                      {item.reviewCount === 0
                        ? 'No evaluations recorded yet'
                        : `${item.reviewCount} evaluation recorded`}{' '}
                      (minimum 2 recommended for fair evaluation).
                    </p>
                  </div>
                ))}

                {(!judgingOverview.attention?.discrepancies?.length &&
                  !judgingOverview.attention?.insufficientReviews?.length) && (
                  <div className="judging-healthy-banner">
                    <CheckCircle size={18} />
                    <span>All submitted projects have consistent evaluations and adequate review coverage.</span>
                  </div>
                )}
              </div>
            </section>

            {/* Judge Progress */}
            <section className="workspace-card organizer-info-panel">
              <div className="judging-section-heading">
                <div>
                  <h2>Judge progress</h2>
                  <p>Individual completion metrics and scoring patterns.</p>
                </div>
              </div>

              {judgingOverview.judgeProgress?.length ? (
                <div className="organizer-table">
                  <div className="organizer-table-head judging-judge-head">
                    <span>Judge</span>
                    <span>Assigned</span>
                    <span>Completed</span>
                    <span>Remaining</span>
                    <span>Avg score</span>
                    <span>Status</span>
                  </div>
                  {judgingOverview.judgeProgress.map((judge) => (
                    <div className="organizer-table-row judging-judge-row" key={judge.judgeId}>
                      <span><strong>{judge.judgeLabel}</strong></span>
                      <span>{judge.assigned}</span>
                      <span>{judge.completed}</span>
                      <span>{judge.remaining}</span>
                      <span>{judge.averageScore ? `${judge.averageScore} / 10` : '—'}</span>
                      <span>
                        {judge.isZeroVariance ? (
                          <span
                            className="judging-badge badge-warning"
                            title="Judge scored all projects identically (std dev 0). Scores are mapped fairly without division error."
                          >
                            Uniform scoring (fairly mapped)
                          </span>
                        ) : (
                          <span className="judging-badge badge-success">Active</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="organizer-empty-inline">No judges assigned or active for this event.</p>
              )}
            </section>

            {/* Fairness & Normalization Leaderboard */}
            <section className="workspace-card organizer-info-panel">
              <div className="judging-section-heading">
                <div>
                  <h2>Final ranking preview</h2>
                  <p>Normalized scores balance strict and lenient judges for fair results.</p>
                </div>
              </div>

              <div className="judging-explain-box">
                Scores are adjusted using Z-score normalization to account for differences between strict and lenient judges, then mapped to a 0–100 scale. If 3 or more evaluations exist, a trimmed mean is applied to mitigate outlier impact. Zero-variance judges are mapped linearly without division errors.
              </div>

              {judgingOverview.leaderboard?.length ? (
                <div className="organizer-table">
                  <div className="organizer-table-head judging-leaderboard-head">
                    <span>Rank</span>
                    <span>Project & Team</span>
                    <span>Track</span>
                    <span>Reviews</span>
                    <span>Raw score</span>
                    <span>Adjusted score</span>
                    <span>Final score</span>
                    <span>Status</span>
                  </div>
                  {judgingOverview.leaderboard.map((item) => (
                    <div className="organizer-table-row judging-leaderboard-row" key={item.projectId}>
                      <span><strong>#{item.rank}</strong></span>
                      <span>
                        <strong>{item.title}</strong>
                        {item.teamName && <small>{item.teamName}</small>}
                      </span>
                      <span>{item.trackName || 'General'}</span>
                      <span>{item.reviewCount}</span>
                      <span>{item.rawScore.toFixed(1)} / 100</span>
                      <span>{item.normalizedScore.toFixed(1)} / 100</span>
                      <span><strong>{item.finalScore.toFixed(1)} / 100</strong></span>
                      <span>
                        {item.hasDiscrepancy ? (
                          <span className="judging-badge badge-warning">Needs attention</span>
                        ) : item.reviewCount >= 2 ? (
                          <span className="judging-badge badge-success">Consistent</span>
                        ) : (
                          <span className="judging-badge badge-neutral">Incomplete</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="organizer-empty-inline">No evaluated projects yet.</p>
              )}
            </section>

            {/* Judging Audit Trail */}
            <section className="workspace-card organizer-info-panel">
              <div className="judging-section-heading">
                <div>
                  <h2>Judging audit trail</h2>
                  <p>Recorded evaluation actions, updates, and score events.</p>
                </div>
              </div>

              {judgingOverview.auditTrail?.length ? (
                <div className="organizer-table">
                  <div className="organizer-table-head judging-audit-head">
                    <span>Time</span>
                    <span>Action</span>
                    <span>Role</span>
                    <span>Details</span>
                  </div>
                  {judgingOverview.auditTrail.map((log) => (
                    <div className="organizer-table-row judging-audit-row" key={log.id}>
                      <span><small>{dateTime(log.timestamp)}</small></span>
                      <span><strong>{formatAuditAction(log.action)}</strong></span>
                      <span><span className="badge-role">{log.actorRole}</span></span>
                      <span>
                        <small>
                          {log.details?.projectTitle
                            ? `Project: ${log.details.projectTitle}`
                            : log.details?.scoreId
                            ? `Score ID: ${log.details.scoreId}`
                            : 'Evaluation event recorded'}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="organizer-empty-inline">No judging audit events recorded yet.</p>
              )}
            </section>
          </>
        )}
      </div>
    )}

    {tab.toLowerCase() === 'results' && <section className="workspace-card organizer-info-panel"><div className="organizer-section-heading"><div><h2>Community vote results</h2><p>Rankings below are based on community votes, not judge scores.</p></div></div>
      {resultsLoading ? <p>Loading community results…</p> : results?.resultsHidden ? <p>{results.message || 'Results are hidden while voting is open.'}</p> : results?.results?.length ? <div className="organizer-table"><div className="organizer-table-head"><span>Rank / Project</span><span>Team · Track</span><span>Votes</span></div>{results.results.map((item) => <div className="organizer-table-row" key={idOf(item.projectId)}><span>#{item.rank} · {item.title}</span><span>{item.teamName} · {item.trackName}</span><span>{item.votes}</span></div>)}</div> : <p>{voting?.isOpen ? 'Voting is open; no results are available yet.' : 'No community vote results are available.'}</p>}
      {voting && <p className="organizer-capability-note">{voting.isOpen ? 'Voting is open; the backend allows organizers to view live community rankings.' : 'Voting is closed.'}{voting.votingCloseAt ? ` · closes ${dateTime(voting.votingCloseAt)}` : ''} No event-scoped results CSV is available.</p>}
    </section>}

    {tab.toLowerCase() === 'settings' && <section className="workspace-card organizer-settings-panel">
      <div className="organizer-section-heading"><h2>Event settings</h2>{!eventForm && <button className="btn-secondary btn-sm" onClick={openEventForm}>Edit Event</button>}</div>
      {eventForm && <form className="organizer-edit-form" onSubmit={saveEvent}><label className="form-group"><span className="form-label">Hackathon name</span><input className="form-input" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} minLength={2} required /></label><label className="form-group"><span className="form-label">Description</span><textarea className="form-input form-textarea" rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label><label className="form-group"><span className="form-label">Status</span><select className="form-input form-select" value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}>{['draft', 'published', 'active', 'ended', 'closed'].map((status) => <option key={status}>{status}</option>)}</select></label>{[['startDate', 'Start'], ['submissionDeadline', 'Submission deadline'], ['endDate', 'End']].map(([key, label]) => <label className="form-group" key={key}><span className="form-label">{label}</span><input type="datetime-local" className="form-input" value={eventForm[key]} onChange={(e) => setEventForm({ ...eventForm, [key]: e.target.value })} required /></label>)}<div className="organizer-inline-actions"><button className="btn-primary btn-sm"><Save size={14} /> Save event</button><button type="button" className="btn-secondary btn-sm" onClick={() => setEventForm(null)}>Cancel</button></div></form>}
      <section className="organizer-config-section"><div className="organizer-section-heading"><div><h3>Tracks</h3><p>Organize submissions into themes or categories.</p></div><button type="button" className="btn-secondary btn-sm" onClick={() => startItemEdit('tracks')}><Plus size={14} /> Add track</button></div>{(event.tracks || []).map((item) => <div className="organizer-setting-row" key={item._id}><span className="organizer-setting-copy"><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span><button type="button" className="organizer-edit-action" aria-label={`Edit track ${item.name}`} onClick={() => startItemEdit('tracks', item)}><Pencil size={14} /><span>Edit track</span></button></div>)}{!event.tracks?.length && <p className="text-muted-sm">No tracks configured.</p>}{itemForm?.kind === 'tracks' && renderItemForm()}</section>
      <section className="organizer-config-section"><div className="organizer-section-heading"><div><h3>Prizes</h3><p>Show participants what they can win.</p></div><button type="button" className="btn-secondary btn-sm" onClick={() => startItemEdit('prizes')}><Plus size={14} /> Add prize</button></div>{(event.prizes || []).map((item) => <div className="organizer-setting-row" key={item._id}><span className="organizer-setting-copy"><strong>{item.name}</strong><small>{[item.value, item.description].filter(Boolean).join(' · ') || 'Prize details not provided'}</small></span><button type="button" className="organizer-edit-action" aria-label={`Edit prize ${item.name}`} onClick={() => startItemEdit('prizes', item)}><Pencil size={14} /><span>Edit prize</span></button></div>)}{!event.prizes?.length && <p className="text-muted-sm">No prizes configured.</p>}{itemForm?.kind === 'prizes' && renderItemForm()}</section>
      <form className="organizer-edit-form organizer-voting-settings" onSubmit={saveVotingWindow}><h3>Community voting schedule</h3><div className="form-group"><label className="form-label" htmlFor="voting-open-at">Voting opens</label><span className="organizer-date-picker"><input id="voting-open-at" ref={votingOpenInput} type="datetime-local" className="form-input event-datetime-input" value={votingForm.votingOpenAt} onChange={(e) => setVotingForm({ ...votingForm, votingOpenAt: e.target.value })} /><button type="button" className="btn-secondary btn-sm" aria-label="Choose voting open date and time" onClick={() => { const input = votingOpenInput.current; if (input?.showPicker) input.showPicker(); else input?.focus(); }}><CalendarDays size={16} /></button></span></div><div className="form-group"><label className="form-label" htmlFor="voting-close-at">Voting closes</label><span className="organizer-date-picker"><input id="voting-close-at" ref={votingCloseInput} type="datetime-local" className="form-input event-datetime-input" value={votingForm.votingCloseAt} onChange={(e) => setVotingForm({ ...votingForm, votingCloseAt: e.target.value })} min={votingForm.votingOpenAt || undefined} /><button type="button" className="btn-secondary btn-sm" aria-label="Choose voting close date and time" onClick={() => { const input = votingCloseInput.current; if (input?.showPicker) input.showPicker(); else input?.focus(); }}><CalendarDays size={16} /></button></span></div><button className="btn-secondary btn-sm"><Save size={14} /> Save voting schedule</button></form>
      <p className="organizer-capability-note">Existing tracks and prizes can be edited. The current API does not support deleting them.</p>
    </section>}

    <ProjectDetailModal project={selectedProject} isOpen={Boolean(selectedProject)} onClose={() => setSelectedProject(null)} />
  </div>;
}

function eventDateRange(event) {
  return `${dateTime(event.startDate)} · Deadline ${dateTime(event.submissionDeadline)}`;
}
