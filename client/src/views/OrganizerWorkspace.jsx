import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectDetailModal from '../components/ProjectDetailModal';
import CertificateModal from '../components/CertificateModal';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Pencil,
  Plus,
  Save,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  UserPlus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Check,
  X,
  Award,
  FileText,
  Copy,
  FileCode,
  UploadCloud,
  Globe,
  RefreshCw,
  Play,
  Code,
  Share2
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'judges', label: 'Judges' },
  { id: 'judging', label: 'Judging' },
  { id: 'results', label: 'Results' },
  { id: 'data', label: 'Data' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'audit', label: 'Audit' },
  { id: 'settings', label: 'Settings' }
];

const WEBHOOK_EVENTS_LIST = [
  { id: 'submission.created', label: 'Submission created' },
  { id: 'submission.updated', label: 'Submission updated' },
  { id: 'judge.assigned', label: 'Judge assigned' },
  { id: 'judging.completed', label: 'Review completed' },
  { id: 'voting.started', label: 'Voting started' },
  { id: 'voting.closed', label: 'Voting closed' },
  { id: 'results.published', label: 'Results published' }
];

const LIFECYCLE_STAGES = ['draft', 'published', 'active', 'judging', 'voting', 'ended', 'closed'];

const NEXT_STAGE_MAP = {
  draft: { label: 'Publish Hackathon', nextStatus: 'published' },
  published: { label: 'Start Hackathon (Active)', nextStatus: 'active' },
  active: { label: 'Start Judging Phase', nextStatus: 'judging' },
  judging: { label: 'Open Voting Phase', nextStatus: 'voting' },
  voting: { label: 'End Hackathon', nextStatus: 'ended' },
  ended: { label: 'Finalize & Close', nextStatus: 'closed' }
};

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
    'judge.assigned': 'Judge assigned',
    'judge.invited': 'Judge invited',
    'judge.assignment_revoked': 'Judge assignment revoked',
    'score.flagged': 'Score flagged',
    'results.published': 'Results published',
    'event.status_published': 'Event published',
    'event.status_active': 'Event started (active)',
    'event.status_judging': 'Judging phase started',
    'event.status_voting': 'Voting phase opened',
    'event.status_ended': 'Event ended',
    'event.status_closed': 'Event closed'
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
  const [assignedJudges, setAssignedJudges] = useState([]);
  const [judgesLoading, setJudgesLoading] = useState(false);
  const [availableJudges, setAvailableJudges] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    mode: 'existing',
    judgeId: '',
    email: '',
    name: '',
    trackId: '',
    assignedAll: true,
    projectIds: []
  });
  const [inviteSuccessInfo, setInviteSuccessInfo] = useState(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishAcknowledged, setPublishAcknowledged] = useState(false);
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Grouped sub-navigation states
  const [resultsSubTab, setResultsSubTab] = useState('results'); // 'results' | 'certificates' | 'verification'
  const [dataSubTab, setDataSubTab] = useState('import'); // 'import' | 'export'
  const [integrationsSubTab, setIntegrationsSubTab] = useState('webhooks'); // 'webhooks' | 'api' | 'embed'

  // Certificates state
  const [eventCertificates, setEventCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [certificateFilter, setCertificateFilter] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [certModalOpen, setCertModalOpen] = useState(false);

  // Verifiable judging records state
  const [judgingRecord, setJudgingRecord] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyInProgress, setVerifyInProgress] = useState(false);

  // Bulk import & export state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importParsedData, setImportParsedData] = useState(null);
  const [importValidation, setImportValidation] = useState(null);
  const [importValidating, setImportValidating] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    targetUrl: '',
    secret: '',
    subscribedEvents: ['submission.created', 'judging.completed', 'results.published']
  });
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState(null);
  const [deliveriesModalWebhook, setDeliveriesModalWebhook] = useState(null);
  const [testingWebhookId, setTestingWebhookId] = useState(null);
  const [testWebhookResult, setTestWebhookResult] = useState(null);

  // Embed gallery state
  const [copiedEmbed, setCopiedEmbed] = useState(false);

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
    setAssignedJudges([]);
    setAvailableJudges([]);
    setAuditLogs([]);
    setEventCertificates([]);
    setJudgingRecord(null);
    setVerificationResult(null);
    setWebhooks([]);
    setCreatedWebhookSecret(null);
    setImportValidation(null);
    setImportParsedData(null);
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

  const loadEventJudges = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    setJudgesLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/judges`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load judges.');
      setAssignedJudges(data.judges || []);
    } catch (err) { setError(err.message); }
    finally { setJudgesLoading(false); }
  }, [eventId, headers, sessionToken]);

  const loadAvailableJudges = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    try {
      const response = await fetch(`/api/events/${eventId}/judges/available`, { headers });
      const data = await response.json();
      if (response.ok) setAvailableJudges(data.availableJudges || []);
    } catch (_) {}
  }, [eventId, headers, sessionToken]);

  const loadAuditLogs = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    setAuditLoading(true);
    const params = new URLSearchParams();
    if (auditFilter) params.set('action', auditFilter);
    try {
      const response = await fetch(`/api/events/${eventId}/audit-logs?${params}`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load audit logs.');
      setAuditLogs(data.logs || []);
    } catch (err) { setError(err.message); }
    finally { setAuditLoading(false); }
  }, [eventId, auditFilter, headers, sessionToken]);

  const loadEventCertificates = useCallback(async () => {
    if (!eventId) return;
    setCertificatesLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/certificates`, { headers });
      const data = await res.json();
      if (res.ok) setEventCertificates(data.certificates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCertificatesLoading(false);
    }
  }, [eventId, headers]);

  const loadJudgingRecord = useCallback(async () => {
    if (!eventId) return;
    setVerificationLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/records/judging`, { headers });
      const data = await res.json();
      if (res.ok) setJudgingRecord(data);
    } catch (err) {
      console.error(err);
    } finally {
      setVerificationLoading(false);
    }
  }, [eventId, headers]);

  const handleVerifyRecord = async () => {
    if (!eventId || !judgingRecord) return;
    setVerifyInProgress(true);
    setVerificationResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/records/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          manifest: judgingRecord.verifiableRecord,
          signature: judgingRecord.signature
        })
      });
      const data = await res.json();
      setVerificationResult({
        verified: data.verified,
        message: data.message || (data.verified ? 'Record signature verified successfully.' : 'Verification failed.')
      });
    } catch (err) {
      setVerificationResult({ verified: false, message: 'Verification request failed: ' + err.message });
    } finally {
      setVerifyInProgress(false);
    }
  };

  const handleDownloadRecord = () => {
    if (!judgingRecord) return;
    const blob = new Blob([JSON.stringify(judgingRecord, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `judging-record-${eventId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadWebhooks = useCallback(async () => {
    if (!eventId || !sessionToken) return;
    setWebhooksLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/webhooks`, { headers });
      const data = await res.json();
      if (res.ok) setWebhooks(data.webhooks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setWebhooksLoading(false);
    }
  }, [eventId, headers, sessionToken]);

  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!eventId) return;
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/webhooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(webhookForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not register webhook.');
      setCreatedWebhookSecret(data.webhook?.secret || null);
      setNotice('Webhook registered successfully.');
      setWebhookForm({
        targetUrl: '',
        secret: '',
        subscribedEvents: ['submission.created', 'judging.completed', 'results.published']
      });
      loadWebhooks();
      loadAuditLogs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleWebhook = async (webhook) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}/webhooks/${webhook._id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ active: !webhook.active })
      });
      if (res.ok) {
        setNotice(`Webhook ${webhook.active ? 'disabled' : 'enabled'}.`);
        loadWebhooks();
        loadAuditLogs();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!eventId || !window.confirm('Delete this webhook endpoint?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        setNotice('Webhook deleted.');
        loadWebhooks();
        loadAuditLogs();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTestWebhook = async (webhookId) => {
    if (!eventId) return;
    setTestingWebhookId(webhookId);
    setTestWebhookResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      setTestWebhookResult({ webhookId, ...data });
      loadWebhooks();
    } catch (err) {
      setTestWebhookResult({ webhookId, error: err.message });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportValidation(null);
    setImportValidating(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);
        setImportParsedData(parsed);

        // Pre-validate with server dry-run
        const res = await fetch(`/api/events/${eventId}/import`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            teams: parsed.teams || [],
            projects: parsed.projects || [],
            validateOnly: true
          })
        });
        const data = await res.json();
        if (res.ok) {
          setImportValidation({
            valid: true,
            teamsCount: data.importedTeamsCount ?? (parsed.teams?.length || 0),
            projectsCount: data.importedProjectsCount ?? (parsed.projects?.length || 0),
            errors: []
          });
        } else {
          setImportValidation({
            valid: false,
            teamsCount: parsed.teams?.length || 0,
            projectsCount: parsed.projects?.length || 0,
            errors: data.errors || [data.message || 'Validation failed']
          });
        }
      } catch (err) {
        setImportValidation({
          valid: false,
          teamsCount: 0,
          projectsCount: 0,
          errors: ['Invalid JSON format: ' + err.message]
        });
      } finally {
        setImportValidating(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!eventId || !importParsedData) return;
    setImportSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teams: importParsedData.teams || [],
          projects: importParsedData.projects || []
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Bulk import failed.');
      }
      setNotice(`Import completed: ${data.importedProjectsCount} projects and ${data.importedTeamsCount} teams created.`);
      setImportModalOpen(false);
      setImportFile(null);
      setImportParsedData(null);
      setImportValidation(null);
      loadSubmissions();
      loadEvent();
      loadAuditLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportSubmitting(false);
    }
  };

  const handleCopyEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/gallery/${eventId}" width="100%" height="600" frameborder="0" allowtransparency="true"></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  useEffect(() => {
    if (!eventId) return;
    loadMetricsAndScores().catch((err) => setError(err.message));
  }, [eventId, loadMetricsAndScores]);
  useEffect(() => {
    if (tab.toLowerCase() === 'submissions') loadSubmissions().catch((err) => setError(err.message));
  }, [tab, loadSubmissions]);
  useEffect(() => {
    if (tab.toLowerCase() === 'results') {
      if (resultsSubTab === 'results') loadResults().catch((err) => setError(err.message));
      if (resultsSubTab === 'certificates') loadEventCertificates().catch((err) => setError(err.message));
      if (resultsSubTab === 'verification') loadJudgingRecord().catch((err) => setError(err.message));
    }
  }, [tab, resultsSubTab, loadResults, loadEventCertificates, loadJudgingRecord]);
  useEffect(() => {
    if (tab.toLowerCase() === 'judging') loadJudgingOverview().catch((err) => setError(err.message));
  }, [tab, loadJudgingOverview]);
  useEffect(() => {
    if (tab.toLowerCase() === 'judges') {
      loadEventJudges().catch((err) => setError(err.message));
      loadAvailableJudges().catch(() => {});
    }
  }, [tab, loadEventJudges, loadAvailableJudges]);
  useEffect(() => {
    if (tab.toLowerCase() === 'audit') {
      loadAuditLogs().catch((err) => setError(err.message));
    }
  }, [tab, loadAuditLogs]);
  useEffect(() => {
    if (tab.toLowerCase() === 'integrations') {
      if (integrationsSubTab === 'webhooks') loadWebhooks().catch((err) => setError(err.message));
    }
  }, [tab, integrationsSubTab, loadWebhooks]);
  useEffect(() => {
    if (tab.toLowerCase() === 'data') {
      loadSubmissions().catch(() => {});
    }
  }, [tab, loadSubmissions]);
  useEffect(() => {
    if (tab.toLowerCase() === 'overview') {
      loadEventJudges().catch(() => {});
      loadJudgingOverview().catch(() => {});
    }
  }, [tab, loadEventJudges, loadJudgingOverview]);

  const handleAdvanceLifecycle = async (nextStatus) => {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update event status.');
      setNotice(`Event status advanced to ${nextStatus}.`);
      await loadEvent();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpenAssignModal = () => {
    loadAvailableJudges();
    setAssignForm({
      mode: 'existing',
      judgeId: availableJudges[0]?._id || '',
      email: '',
      name: '',
      trackId: '',
      assignedAll: true,
      projectIds: []
    });
    setInviteSuccessInfo(null);
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let endpoint = `/api/events/${eventId}/judges/assign`;
      let payload = {
        trackId: assignForm.trackId || null,
        assignedAll: assignForm.assignedAll,
        projectIds: assignForm.assignedAll ? [] : assignForm.projectIds
      };

      if (assignForm.mode === 'existing') {
        if (!assignForm.judgeId) {
          setError('Please select a judge.');
          return;
        }
        payload.judgeId = assignForm.judgeId;
      } else {
        if (!assignForm.email || !assignForm.email.includes('@')) {
          setError('Please provide a valid email address.');
          return;
        }
        endpoint = `/api/events/${eventId}/judges/invite`;
        payload.email = assignForm.email.trim();
        payload.name = assignForm.name.trim();
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to assign judge.');

      if (data.inviteLink) {
        setInviteSuccessInfo({
          email: assignForm.email,
          inviteLink: `${window.location.origin}${data.inviteLink}`,
          inviteToken: data.inviteToken
        });
      } else {
        setAssignModalOpen(false);
      }

      setNotice('Judge assigned successfully.');
      await loadEventJudges();
      await loadJudgingOverview();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevokeJudge = async (judgeId) => {
    if (!window.confirm('Are you sure you want to revoke this judge assignment?')) return;
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}/judges/${judgeId}/assignment`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to revoke judge assignment.');
      setNotice('Judge assignment revoked.');
      await loadEventJudges();
      await loadJudgingOverview();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePublishResults = async (e) => {
    e.preventDefault();
    setError('');
    setPublishSubmitting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/results/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ acknowledgeWarnings: publishAcknowledged })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not publish results.');
      setNotice('Final hackathon results published successfully.');
      setPublishModalOpen(false);
      await loadEvent();
      await loadResults();
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishSubmitting(false);
    }
  };

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

  const filteredSubmissions = useMemo(() => {
    return projects.filter((project) => {
      if (trackFilter && idOf(project.trackId) !== trackFilter && project.trackId?.name !== trackFilter) {
        return false;
      }
      if (statusFilter && project.status !== statusFilter) {
        return false;
      }
      if (teamFilter && !((project.teamId?.name || '').toLowerCase().includes(teamFilter.toLowerCase()))) {
        return false;
      }
      return true;
    });
  }, [projects, trackFilter, statusFilter, teamFilter]);

  const incompleteJudgesCount = useMemo(() => {
    return assignedJudges.filter((j) => j.remainingReviewsCount > 0).length;
  }, [assignedJudges]);

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
      <div>
        <button className="text-button" onClick={() => onNavigate('my-events')}>
          <ArrowLeft size={15} /> My Hackathons
        </button>
        <p className="organizer-eyebrow">Organizer · Hackathon</p>
        <h1 className="page-title">{event.name}</h1>
      </div>
      <span className={`organizer-status status-${event.status}`}>{event.status}</span>
    </div>

    {/* Event Lifecycle Stepper */}
    <div className="organizer-lifecycle-banner">
      <div className="lifecycle-steps-track">
        {LIFECYCLE_STAGES.map((st, idx) => {
          const isCurrent = event.status === st;
          const isPassed = LIFECYCLE_STAGES.indexOf(event.status) > idx;
          return (
            <React.Fragment key={st}>
              <span className={`lifecycle-step-node ${isCurrent ? 'active' : isPassed ? 'completed' : ''}`}>
                {isPassed ? <Check size={12} /> : null}
                {st}
              </span>
              {idx < LIFECYCLE_STAGES.length - 1 && <span className="lifecycle-separator">→</span>}
            </React.Fragment>
          );
        })}
      </div>
      {NEXT_STAGE_MAP[event.status] && (
        <div className="lifecycle-action-container">
          <button
            className="btn-primary btn-sm"
            onClick={() => handleAdvanceLifecycle(NEXT_STAGE_MAP[event.status].nextStatus)}
          >
            {NEXT_STAGE_MAP[event.status].label}
          </button>
        </div>
      )}
    </div>

    <nav className="organizer-workspace-tabs" aria-label={`${event.name} management`}>
      {TABS.map((item) => (
        <button
          key={item.id}
          className={tab.toLowerCase() === item.id ? 'active' : ''}
          aria-current={tab.toLowerCase() === item.id ? 'page' : undefined}
          onClick={() => {
            setTab(item.label);
            setError('');
            setNotice('');
            onNavigate('event-workspace', { eventId, tab: item.id });
          }}
        >
          {item.label}
        </button>
      ))}
    </nav>

    {(error || notice) && <p className={error ? 'event-date-error' : 'organizer-notice'} role={error ? 'alert' : 'status'}>{error || notice}</p>}

    {/* ========================================================
        Tab: Overview
        ======================================================== */}
    {tab.toLowerCase() === 'overview' && <>
      <section className="workspace-card organizer-overview-panel">
        <div className="organizer-section-heading">
          <h2>Overview</h2>
          <button className="btn-secondary btn-sm" onClick={() => { openEventForm(); navigateTab('Settings'); }}>Edit Event</button>
        </div>
        <dl className="workspace-event-dates">
          <dt>Starts</dt><dd>{dateTime(event.startDate)}</dd>
          <dt>Submission deadline</dt><dd>{dateTime(event.submissionDeadline)}</dd>
          <dt>Ends</dt><dd>{dateTime(event.endDate)}</dd>
          <dt>Tracks</dt><dd>{event.tracks?.length || 0}</dd>
          <dt>Submitted projects</dt><dd>{metrics?.participation?.submittedProjects ?? 'Loading…'}</dd>
          <dt>Judges assigned / active</dt><dd>{judgesLoading ? 'Loading…' : assignedJudges.length || scoredJudges.length}</dd>
          <dt>Reviews recorded</dt><dd>{analyticsLoading ? 'Loading…' : scores.length}</dd>
        </dl>
      </section>

      {/* Actionable Needs Attention Section */}
      <section className="workspace-card organizer-needs-attention-box">
        <div className="organizer-section-heading">
          <div>
            <h2>Needs attention</h2>
            <p>Actionable operational alerts requiring organizer review or coordination.</p>
          </div>
        </div>

        <div className="needs-attention-grid">
          {/* Discrepancies */}
          {(judgingOverview?.attention?.discrepancies?.length || 0) > 0 && (
            <div className="needs-attention-card">
              <div className="needs-attention-info">
                <span className="needs-attention-title">
                  {judgingOverview.attention.discrepancies.length} score discrepancies detected
                </span>
                <span className="needs-attention-desc">Reviewers differ by &gt; 2.0 points on evaluated criteria.</span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => navigateTab('Judging')}>
                Review Scores
              </button>
            </div>
          )}

          {/* Insufficient reviews */}
          {(judgingOverview?.attention?.insufficientReviews?.length || 0) > 0 && (
            <div className="needs-attention-card">
              <div className="needs-attention-info">
                <span className="needs-attention-title">
                  {judgingOverview.attention.insufficientReviews.length} projects have insufficient reviews
                </span>
                <span className="needs-attention-desc">Fewer than 2 reviews recorded per project.</span>
              </div>
              <button className="btn-secondary btn-sm" onClick={handleOpenAssignModal}>
                Assign Judges
              </button>
            </div>
          )}

          {/* Incomplete judge reviews */}
          {incompleteJudgesCount > 0 && (
            <div className="needs-attention-card info">
              <div className="needs-attention-info">
                <span className="needs-attention-title">
                  {incompleteJudgesCount} judge{incompleteJudgesCount > 1 ? 's have' : ' has'} pending reviews
                </span>
                <span className="needs-attention-desc">Assigned reviews have not been submitted yet.</span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => navigateTab('Judges')}>
                View Judges
              </button>
            </div>
          )}

          {/* Voting schedule */}
          {!event.votingOpenAt && (
            <div className="needs-attention-card info">
              <div className="needs-attention-info">
                <span className="needs-attention-title">Community voting schedule not set</span>
                <span className="needs-attention-desc">Configure start and end window to open community participation.</span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => navigateTab('Settings')}>
                Configure Schedule
              </button>
            </div>
          )}

          {/* Deadline */}
          {event.submissionDeadline && Date.now() < new Date(event.submissionDeadline).getTime() && new Date(event.submissionDeadline).getTime() - Date.now() < 7 * 86400000 && (
            <div className="needs-attention-card">
              <div className="needs-attention-info">
                <span className="needs-attention-title">Submission deadline approaching</span>
                <span className="needs-attention-desc">Submissions close {dateTime(event.submissionDeadline)}.</span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => navigateTab('Submissions')}>
                View Submissions
              </button>
            </div>
          )}

          {!judgingOverview?.attention?.discrepancies?.length &&
           !judgingOverview?.attention?.insufficientReviews?.length &&
           incompleteJudgesCount === 0 &&
           event.votingOpenAt && (
            <div className="judging-healthy-banner" style={{ gridColumn: '1 / -1' }}>
              <CheckCircle size={18} />
              <span>All operational tasks are on track. No pending discrepancies or reviewer bottlenecks.</span>
            </div>
          )}
        </div>
      </section>

      <section className="organizer-next-actions">
        <h2>Next actions</h2>
        <div>
          {(!event.tracks?.length || !event.prizes?.length) && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Settings')}>Complete event setup</button>}
          {(metrics?.participation?.submittedProjects || 0) > 0 && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Judging')}>View review activity</button>}
          <button className="btn-secondary btn-sm" onClick={handleOpenAssignModal}><UserPlus size={14} /> Invite or assign judge</button>
          {event.submissionDeadline && Date.now() < new Date(event.submissionDeadline).getTime() && new Date(event.submissionDeadline).getTime() - Date.now() < 7 * 86400000 && <button className="btn-secondary btn-sm" onClick={() => navigateTab('Submissions')}>Review incoming submissions</button>}
        </div>
      </section>
    </>}

    {/* ========================================================
        Tab: Submissions
        ======================================================== */}
    {tab.toLowerCase() === 'submissions' && <section className="organizer-section">
      <div className="organizer-section-heading">
        <div>
          <h2>Submissions</h2>
          <p>Review, filter, and inspect project submissions for this event.</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => downloadCsv('projects')}>
          <Download size={14} /> Export projects CSV
        </button>
      </div>

      <div className="submissions-filter-bar">
        <input
          className="form-input"
          style={{ maxWidth: '240px' }}
          aria-label="Search submissions"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input form-select"
          style={{ maxWidth: '180px' }}
          aria-label="Filter by track"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
        >
          <option value="">All Tracks</option>
          {(event.tracks || []).map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
        <select
          className="form-input form-select"
          style={{ maxWidth: '160px' }}
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="draft">Draft</option>
        </select>
        <input
          className="form-input"
          style={{ maxWidth: '180px' }}
          aria-label="Filter by team"
          placeholder="Filter by team..."
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        />
      </div>

      {submissionsLoading ? (
        <div className="empty-loading-state">Loading submissions…</div>
      ) : filteredSubmissions.length ? (
        <div className="organizer-submission-list">
          {filteredSubmissions.map((project) => (
            <article className="organizer-submission-row" key={project._id}>
              <div>
                <span className={`organizer-submission-status status-${project.status}`}>
                  {project.status === 'submitted' ? 'Submitted' : 'Draft'}
                </span>
                <h3>{project.title}</h3>
                <p>{project.teamId?.name || 'Independent'} · {project.trackId?.name || 'No track'}</p>
                <small>Submitted {dateTime(project.updatedAt || project.createdAt)}</small>
                {project.repositoryUrl && (
                  <div className="submissions-links-row">
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="submissions-link"
                    >
                      <ExternalLink size={12} /> Repository
                    </a>
                  </div>
                )}
              </div>
              <div className="organizer-row-actions">
                <button className="btn-secondary btn-sm" onClick={() => setSelectedProject(project)}>
                  View Project
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="organizer-empty-inline">No submissions match the selected filters.</p>
      )}
    </section>}

    {/* ========================================================
        Tab: Judges
        ======================================================== */}
    {tab.toLowerCase() === 'judges' && <section className="workspace-card organizer-info-panel">
      <div className="organizer-judges-header">
        <div>
          <h2>Judge Management</h2>
          <p>Invite judges, assign specific tracks or projects, and track evaluation progress.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleOpenAssignModal}>
          <UserPlus size={14} /> Invite / Assign Judge
        </button>
      </div>

      {/* Judge Metrics Grid */}
      <div className="judging-kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="judging-kpi-card">
          <span className="judging-kpi-num">{assignedJudges.length || scoredJudges.length}</span>
          <span className="judging-kpi-label">Total judges</span>
        </div>
        <div className="judging-kpi-card">
          <span className="judging-kpi-num">
            {assignedJudges.reduce((acc, j) => acc + (j.completedReviewsCount || 0), 0) || scores.length}
          </span>
          <span className="judging-kpi-label">Reviews completed</span>
        </div>
        <div className="judging-kpi-card">
          <span className="judging-kpi-num">
            {assignedJudges.reduce((acc, j) => acc + (j.remainingReviewsCount || 0), 0)}
          </span>
          <span className="judging-kpi-label">Reviews remaining</span>
        </div>
      </div>

      {judgesLoading ? (
        <div className="empty-loading-state">Loading judges…</div>
      ) : (assignedJudges.length > 0 || scoredJudges.length > 0) ? (
        <div className="organizer-table">
          <div className="organizer-table-head organizer-judges-table-head">
            <span>Judge</span>
            <span>Track</span>
            <span>Assigned</span>
            <span>Completed</span>
            <span>Remaining</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {(assignedJudges.length ? assignedJudges : scoredJudges).map((judge) => {
            const isAssigned = Boolean(judge.assignmentId);
            return (
              <div className="organizer-table-row organizer-judges-table-row" key={judge.judgeId || judge.id}>
                <span>
                  <strong>{judge.name || judge.email?.split('@')[0]}</strong>
                  <small style={{ display: 'block', color: 'var(--text-muted)' }}>{judge.email}</small>
                </span>
                <span>{judge.track?.name || (judge.assignedAll ? 'All Tracks' : 'General')}</span>
                <span>{judge.assignedProjectsCount !== undefined ? `${judge.assignedProjectsCount} assigned` : '—'}</span>
                <span>{judge.completedReviewsCount !== undefined ? `${judge.completedReviewsCount} completed` : `${judge.reviews} completed`}</span>
                <span>{judge.remainingReviewsCount !== undefined ? `${judge.remainingReviewsCount} remaining` : '—'}</span>
                <span>
                  <span className={`judging-badge ${judge.status === 'Completed' ? 'badge-success' : judge.status === 'In Progress' ? 'badge-warning' : 'badge-neutral'}`}>
                    {judge.status || 'Active'}
                  </span>
                </span>
                <span>
                  {isAssigned ? (
                    <button
                      className="judge-revoke-btn"
                      onClick={() => handleRevokeJudge(judge.judgeId)}
                      title="Revoke active assignment"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  ) : (
                    <span className="text-muted-sm">Active Judge</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="organizer-empty-inline">
          No judges assigned to this hackathon yet. Click <strong>Invite / Assign Judge</strong> to assign evaluators.
        </p>
      )}
    </section>}

    {/* ========================================================
        Tab: Judging (Control Center)
        ======================================================== */}
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
          </>
        )}
      </div>
    )}

    {/* ========================================================
        Tab: Results (Workflow, Certificates & Verification)
        ======================================================== */}
    {tab.toLowerCase() === 'results' && <section className="workspace-card organizer-info-panel">
      {/* Grouped Secondary Navigation */}
      <div className="organizer-subnav-bar">
        <button
          type="button"
          className={`subnav-pill ${resultsSubTab === 'results' ? 'active' : ''}`}
          onClick={() => setResultsSubTab('results')}
        >
          Results Standings
        </button>
        <button
          type="button"
          className={`subnav-pill ${resultsSubTab === 'certificates' ? 'active' : ''}`}
          onClick={() => { setResultsSubTab('certificates'); loadEventCertificates(); }}
        >
          Certificates
        </button>
        <button
          type="button"
          className={`subnav-pill ${resultsSubTab === 'verification' ? 'active' : ''}`}
          onClick={() => { setResultsSubTab('verification'); loadJudgingRecord(); }}
        >
          Verification
        </button>
      </div>

      {resultsSubTab === 'results' && (
        <>
          {/* 5-Step Results Workflow Pipeline */}
          <div className="results-pipeline-bar">
            <div className="pipeline-step completed">
              <CheckCircle size={14} /> 1. Judging Complete
            </div>
            <ChevronRight size={14} className="text-muted" />
            <div className="pipeline-step completed">
              <CheckCircle size={14} /> 2. Review Scores
            </div>
            <ChevronRight size={14} className="text-muted" />
            <div className="pipeline-step completed">
              <CheckCircle size={14} /> 3. Resolve Discrepancies
            </div>
            <ChevronRight size={14} className="text-muted" />
            <div className="pipeline-step active">
              <ChevronRight size={14} /> 4. Calculate Final Results
            </div>
            <ChevronRight size={14} className="text-muted" />
            <div className={`pipeline-step ${event.resultsPublished ? 'completed' : ''}`}>
              {event.resultsPublished ? <CheckCircle size={14} /> : <Award size={14} />} 5. Publish Results
            </div>
          </div>

          <div className="organizer-section-heading">
            <div>
              <h2>Hackathon Results & Publishing</h2>
              <p>Inspect finalized scores, acknowledge evaluation warnings, and publish winner standings.</p>
            </div>
            {!event.resultsPublished ? (
              <button className="btn-primary btn-sm" onClick={() => setPublishModalOpen(true)}>
                <Award size={14} /> Publish Final Results
              </button>
            ) : (
              <div className="judging-badge badge-success">
                <CheckCircle size={13} style={{ marginRight: '4px' }} /> Results Published
              </div>
            )}
          </div>

          {event.resultsPublished && (
            <div className="judging-healthy-banner" style={{ marginBottom: '1.25rem' }}>
              <CheckCircle size={18} />
              <span>
                Final winner results have been published and are live for participants. (Published {dateTime(event.resultsPublishedAt)})
              </span>
            </div>
          )}

          {/* Community vote rankings */}
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>Community Vote Standings</h3>
          {resultsLoading ? <p>Loading community results…</p> : results?.resultsHidden ? <p>{results.message || 'Results are hidden while voting is open.'}</p> : results?.results?.length ? <div className="organizer-table"><div className="organizer-table-head"><span>Rank / Project</span><span>Team · Track</span><span>Votes</span></div>{results.results.map((item) => <div className="organizer-table-row" key={idOf(item.projectId)}><span>#{item.rank} · {item.title}</span><span>{item.teamName} · {item.trackName}</span><span>{item.votes}</span></div>)}</div> : <p>{voting?.isOpen ? 'Voting is open; no results are available yet.' : 'No community vote results are available.'}</p>}
          {voting && <p className="organizer-capability-note">{voting.isOpen ? 'Voting is open; the backend allows organizers to view live community rankings.' : 'Voting is closed.'}{voting.votingCloseAt ? ` · closes ${dateTime(voting.votingCloseAt)}` : ''}</p>}
        </>
      )}

      {resultsSubTab === 'certificates' && (
        <>
          <div className="organizer-section-heading">
            <div>
              <h2>Verifiable Certificates</h2>
              <p>Issue, inspect, and download cryptographic certificates of participation, winner awards, and judging excellence.</p>
            </div>
            <select
              className="form-input form-select"
              style={{ maxWidth: '200px' }}
              value={certificateFilter}
              onChange={(e) => setCertificateFilter(e.target.value)}
            >
              <option value="">All Certificates</option>
              <option value="participation">Participation</option>
              <option value="winner">Winner Awards</option>
              <option value="judge">Judging Excellence</option>
            </select>
          </div>

          {certificatesLoading ? (
            <div className="empty-loading-state">Loading certificates…</div>
          ) : eventCertificates.length ? (
            <div className="organizer-table">
              <div className="organizer-table-head" style={{ gridTemplateColumns: '1.8fr 1.5fr 1.8fr 1.5fr' }}>
                <span>Recipient</span>
                <span>Certificate Type</span>
                <span>Project / Role</span>
                <span>Actions</span>
              </div>
              {eventCertificates
                .filter(c => !certificateFilter || c.type === certificateFilter)
                .map((cert, idx) => (
                  <div className="organizer-table-row" style={{ gridTemplateColumns: '1.8fr 1.5fr 1.8fr 1.5fr' }} key={idx}>
                    <span>
                      <strong>{cert.recipientEmail}</strong>
                    </span>
                    <span>
                      <span className={`judging-badge ${cert.type === 'winner' ? 'badge-success' : cert.type === 'judge' ? 'badge-warning' : 'badge-neutral'}`}>
                        {cert.award || cert.type}
                      </span>
                    </span>
                    <span>{cert.projectTitle || cert.teamName || 'Evaluator'}</span>
                    <span style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedCert(cert);
                          setCertModalOpen(true);
                        }}
                      >
                        <Award size={12} /> View
                      </button>
                      <a
                        className="btn-secondary btn-sm"
                        href={`/api/events/${eventId}/certificates/${cert.type}/${cert.recipientId}?format=html`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download size={12} /> Download
                      </a>
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="organizer-empty-inline">No eligible certificates generated yet. Certificates are available for submitted projects and judges.</p>
          )}
        </>
      )}

      {resultsSubTab === 'verification' && (
        <>
          <div className="organizer-section-heading">
            <div>
              <h2>Verifiable Judging Records</h2>
              <p>Cryptographically signed manifest verifying evaluation authenticity and integrity using HMAC-SHA256.</p>
            </div>
            <div className="organizer-inline-actions">
              <button
                className="btn-secondary btn-sm"
                onClick={handleDownloadRecord}
                disabled={!judgingRecord}
              >
                <Download size={14} /> Download Record JSON
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleVerifyRecord}
                disabled={!judgingRecord || verifyInProgress}
              >
                <ShieldCheck size={14} /> {verifyInProgress ? 'Verifying…' : 'Verify Record'}
              </button>
            </div>
          </div>

          {verificationResult && (
            <div className={`verification-summary-banner ${verificationResult.verified ? 'valid' : 'invalid'}`}>
              {verificationResult.verified ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{verificationResult.verified ? '✓ Record is valid' : '✕ Record could not be verified'} — {verificationResult.message}</span>
            </div>
          )}

          <div className="verification-desc-box">
            <h4>What does verification mean?</h4>
            <p>
              HackHub cryptographically signs the complete judging ledger using HMAC-SHA256. Anyone with this manifest can mathematically verify that no project scores, reviewer comments, or final rankings were altered after judging concluded. Judge identities are protected using cryptographically salted pseudonyms.
            </p>
          </div>

          {verificationLoading ? (
            <div className="empty-loading-state">Loading verification records…</div>
          ) : judgingRecord ? (
            <div>
              <dl className="workspace-event-dates" style={{ marginBottom: '1.25rem' }}>
                <dt>Judging Record</dt>
                <dd><code>{judgingRecord.verifiableRecord?.recordType || 'OFFICIAL_JUDGING_RECORD'}</code></dd>
                <dt>Generated</dt>
                <dd>{dateTime(judgingRecord.verifiableRecord?.publishedAt)}</dd>
                <dt>Integrity status</dt>
                <dd>
                  <span className="judging-badge badge-success">
                    Signed ({judgingRecord.verificationAlgorithm || 'HMAC-SHA256'})
                  </span>
                </dd>
                <dt>Evaluated projects</dt>
                <dd>{judgingRecord.verifiableRecord?.evaluatedProjectsCount || 0}</dd>
                <dt>Total evaluations</dt>
                <dd>{judgingRecord.verifiableRecord?.totalEvaluations || 0}</dd>
                <dt>Cryptographic signature</dt>
                <dd><code style={{ fontSize: '0.74rem', wordBreak: 'break-all' }}>{judgingRecord.signature}</code></dd>
              </dl>

              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>Anonymized Evaluation Ledger</h3>
              <div className="organizer-table">
                <div className="organizer-table-head" style={{ gridTemplateColumns: '60px 1.8fr 1fr 2.5fr' }}>
                  <span>Rank</span>
                  <span>Project Title</span>
                  <span>Average Score</span>
                  <span>Evaluator Pseudonyms (Anonymized)</span>
                </div>
                {(judgingRecord.verifiableRecord?.results || []).map((res) => (
                  <div className="organizer-table-row" style={{ gridTemplateColumns: '60px 1.8fr 1fr 2.5fr' }} key={res.projectId}>
                    <span><strong>#{res.rank}</strong></span>
                    <span><strong>{res.title}</strong></span>
                    <span>{res.averageScore.toFixed(2)} / 100</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {res.evaluations?.map((ev, i) => (
                        <span className="judging-badge badge-neutral" key={i} title={`Score: ${ev.normalizedScore}`}>
                          {ev.judgePseudonym} ({ev.normalizedScore.toFixed(1)})
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="organizer-empty-inline">No judging records generated yet. Evaluate submissions to establish a verifiable record.</p>
          )}
        </>
      )}
    </section>}

    {/* ========================================================
        Tab: Data (Bulk Import & Export)
        ======================================================== */}
    {tab.toLowerCase() === 'data' && <section className="workspace-card organizer-info-panel">
      <div className="organizer-subnav-bar">
        <button
          type="button"
          className={`subnav-pill ${dataSubTab === 'import' ? 'active' : ''}`}
          onClick={() => setDataSubTab('import')}
        >
          Import Data
        </button>
        <button
          type="button"
          className={`subnav-pill ${dataSubTab === 'export' ? 'active' : ''}`}
          onClick={() => setDataSubTab('export')}
        >
          Export Event
        </button>
      </div>

      {dataSubTab === 'import' && (
        <div>
          <div className="organizer-section-heading">
            <div>
              <h2>Bulk Data Import</h2>
              <p>Transactionally import teams and project submissions with automated pre-validation.</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => setImportModalOpen(true)}>
              <UploadCloud size={14} /> Import Data
            </button>
          </div>

          <div className="verification-desc-box">
            <h4>Transactional Integrity Guarantee</h4>
            <p>
              HackHub executes bulk imports atomically. Before any records are written to the database, the server runs strict pre-validation on all team names, project titles, and schema constraints. If even a single item fails, the entire transaction is rejected and the database is left untouched.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.65)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.92rem', marginBottom: '0.5rem' }}>Expected JSON Import Format</h3>
            <pre style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#e2e8f0', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', overflowX: 'auto' }}>
{`{
  "teams": [
    { "name": "Quantum Leap Labs" },
    { "name": "CyberShield Collective" }
  ],
  "projects": [
    {
      "title": "Quantum Qubit Simulator",
      "teamName": "Quantum Leap Labs",
      "description": "Simulation platform for quantum circuits",
      "repositoryUrl": "https://github.com/team/qubit-sim",
      "status": "submitted"
    }
  ]
}`}
            </pre>
          </div>
        </div>
      )}

      {dataSubTab === 'export' && (
        <div>
          <div className="organizer-section-heading">
            <div>
              <h2>Event Export Archive</h2>
              <p>Download complete event JSON archives and structured CSV files for analysis.</p>
            </div>
          </div>

          <div className="export-card-grid">
            <div className="export-card">
              <div>
                <h3>Full Event Archive (JSON)</h3>
                <p>Complete JSON snapshot including hackathon metadata, tracks, prizes, teams, submissions, and aggregate statistics.</p>
              </div>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  window.open(`/api/events/${eventId}/export/full`, '_blank');
                }}
              >
                <Download size={14} /> Export Event JSON
              </button>
            </div>

            <div className="export-card">
              <div>
                <h3>Project Submissions (CSV)</h3>
                <p>Comma-separated list of all project submissions, tracks, assigned teams, repository URLs, and submission statuses.</p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => downloadCsv('projects')}>
                <Download size={14} /> Export Projects CSV
              </button>
            </div>

            <div className="export-card">
              <div>
                <h3>Evaluation Results (CSV)</h3>
                <p>Complete judging records including individual criteria scores, judge emails, reviewer comments, and weighted totals.</p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => downloadCsv('judging')}>
                <Download size={14} /> Export Results CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </section>}

    {/* ========================================================
        Tab: Integrations (Webhooks, API & Embed Gallery)
        ======================================================== */}
    {tab.toLowerCase() === 'integrations' && <section className="workspace-card organizer-info-panel">
      <div className="organizer-subnav-bar">
        <button
          type="button"
          className={`subnav-pill ${integrationsSubTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => { setIntegrationsSubTab('webhooks'); loadWebhooks(); }}
        >
          Webhooks
        </button>
        <button
          type="button"
          className={`subnav-pill ${integrationsSubTab === 'api' ? 'active' : ''}`}
          onClick={() => setIntegrationsSubTab('api')}
        >
          API Documentation
        </button>
        <button
          type="button"
          className={`subnav-pill ${integrationsSubTab === 'embed' ? 'active' : ''}`}
          onClick={() => setIntegrationsSubTab('embed')}
        >
          Embed Gallery
        </button>
      </div>

      {integrationsSubTab === 'webhooks' && (
        <div>
          <div className="organizer-section-heading">
            <div>
              <h2>Webhook Management</h2>
              <p>Deliver real-time event notifications to external services with cryptographic HMAC-SHA256 signatures.</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => { setCreatedWebhookSecret(null); setWebhookModalOpen(true); }}>
              <Plus size={14} /> Add Webhook
            </button>
          </div>

          {createdWebhookSecret && (
            <div className="copy-secret-banner">
              <strong><ShieldCheck size={16} /> New Webhook Signing Secret (Copy Once):</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <code style={{ fontSize: '0.85rem' }}>{createdWebhookSecret}</code>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(createdWebhookSecret);
                    setNotice('Webhook secret copied to clipboard.');
                  }}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
              <small>For security reasons, this secret cannot be viewed again after this notification is closed.</small>
            </div>
          )}

          {testWebhookResult && (
            <div className={`alert-box ${testWebhookResult.error ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
              <span>
                {testWebhookResult.error
                  ? `Test ping failed: ${testWebhookResult.error}`
                  : `Test ping dispatched to webhook (Status: ${testWebhookResult.lastDelivery?.statusCode || 200}, Event: ${testWebhookResult.lastDelivery?.event || 'test.ping'})`}
              </span>
            </div>
          )}

          {webhooksLoading ? (
            <div className="empty-loading-state">Loading webhooks…</div>
          ) : webhooks.length ? (
            <div className="organizer-table">
              <div className="organizer-table-head webhook-table-head">
                <span>Webhook URL</span>
                <span>Events</span>
                <span>Status</span>
                <span>Last delivery</span>
                <span>Failures</span>
                <span>Actions</span>
              </div>
              {webhooks.map((hook) => (
                <div className="organizer-table-row webhook-table-row" key={hook._id}>
                  <span>
                    <code style={{ fontSize: '0.78rem' }}>{hook.targetUrl}</code>
                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>Secret: {hook.secret}</small>
                  </span>
                  <span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {hook.subscribedEvents?.map((evId) => {
                        const evObj = WEBHOOK_EVENTS_LIST.find(e => e.id === evId);
                        return (
                          <span className="judging-badge badge-neutral" key={evId}>
                            {evObj ? evObj.label : evId === '*' ? 'All Events' : evId}
                          </span>
                        );
                      })}
                    </div>
                  </span>
                  <span>
                    <span className={`judging-badge ${hook.active ? 'badge-success' : 'badge-neutral'}`}>
                      {hook.active ? 'Active' : 'Disabled'}
                    </span>
                  </span>
                  <span>
                    {hook.lastDelivery ? (
                      <small>
                        {dateTime(hook.lastDelivery.timestamp)} ({hook.lastDelivery.statusCode || 200})
                      </small>
                    ) : (
                      <small className="text-muted">Never</small>
                    )}
                  </span>
                  <span>
                    <span className={`judging-badge ${hook.failures > 0 ? 'badge-warning' : 'badge-neutral'}`}>
                      {hook.failures || 0}
                    </span>
                  </span>
                  <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleTestWebhook(hook._id)}
                      disabled={testingWebhookId === hook._id}
                      title="Dispatch test ping"
                    >
                      <Play size={11} /> {testingWebhookId === hook._id ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleToggleWebhook(hook)}
                      title={hook.active ? 'Disable webhook' : 'Enable webhook'}
                    >
                      {hook.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => setDeliveriesModalWebhook(hook)}
                      title="View delivery history"
                    >
                      Deliveries
                    </button>
                    <button
                      className="judge-revoke-btn"
                      onClick={() => handleDeleteWebhook(hook._id)}
                      title="Delete webhook"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="organizer-empty-inline">No webhooks registered yet. Click <strong>Add Webhook</strong> to connect external dispatch endpoints.</p>
          )}
        </div>
      )}

      {integrationsSubTab === 'api' && (
        <div>
          <div className="organizer-section-heading">
            <div>
              <h2>REST API & OpenAPI 3.0 Documentation</h2>
              <p>Offline-ready REST endpoints conforming to the OpenAPI 3.0.3 specification.</p>
            </div>
            <div className="organizer-inline-actions">
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-sm"
              >
                <ExternalLink size={14} /> Open API Docs ↗
              </a>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm"
              >
                <Download size={14} /> OpenAPI JSON
              </a>
            </div>
          </div>

          <div className="verification-desc-box">
            <h4>100% Offline Capability</h4>
            <p>
              HackHub serves complete interactive documentation directly from <code>/api/docs</code> without external CDN scripts, third-party fonts, or internet access. You can safely inspect schemas, authentication requirements, and error payloads in isolated environments.
            </p>
          </div>

          <div className="export-card-grid">
            <div className="export-card">
              <div>
                <h3>Project & Gallery Endpoints</h3>
                <p>Query submitted projects, explore track themes, and inspect public repository entries.</p>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>GET /api/projects</code>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.2rem' }}>GET /api/events/:id/projects</code>
              </div>
            </div>

            <div className="export-card">
              <div>
                <h3>Verifiable Records & Certificates</h3>
                <p>Retrieve cryptographically signed judging manifests and participation credentials.</p>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>GET /api/events/:id/records/judging</code>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.2rem' }}>POST /api/events/:id/records/verify</code>
              </div>
            </div>

            <div className="export-card">
              <div>
                <h3>Event Webhooks Dispatch</h3>
                <p>Programmatically register webhook endpoints and receive signed HMAC-SHA256 payloads.</p>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.4rem' }}>POST /api/events/:id/webhooks</code>
                <code style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.2rem' }}>GET /api/events/:id/webhooks</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {integrationsSubTab === 'embed' && (
        <div>
          <div className="organizer-section-heading">
            <div>
              <h2>Embeddable Project Gallery</h2>
              <p>Embed a live, responsive project gallery on any external website using a standalone iframe.</p>
            </div>
            <button className="btn-primary btn-sm" onClick={handleCopyEmbed}>
              <Copy size={14} /> {copiedEmbed ? 'Copied to Clipboard!' : 'Copy Embed Code'}
            </button>
          </div>

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Paste this HTML snippet into your external site, blog, or community portal:
          </p>

          <div className="embed-code-box">
            {`<iframe src="${window.location.origin}/embed/gallery/${eventId}" width="100%" height="600" frameborder="0" allowtransparency="true"></iframe>`}
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            The embed endpoint is publicly accessible and contains only public project submissions, team names, and repository links. No judge identities, private scoring criteria, or session tokens are included.
          </p>

          <div style={{ marginTop: '1.25rem' }}>
            <h3 style={{ fontSize: '0.94rem', marginBottom: '0.5rem' }}>Live Gallery Preview</h3>
            <iframe
              src={`/embed/gallery/${eventId}`}
              title="Hackathon Public Gallery Preview"
              style={{
                width: '100%',
                height: '420px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: '#fff'
              }}
            />
          </div>
        </div>
      )}
    </section>}

    {/* ========================================================
        Tab: Audit
        ======================================================== */}
    {tab.toLowerCase() === 'audit' && <section className="workspace-card organizer-info-panel">
      <div className="organizer-section-heading">
        <div>
          <h2>Operational Audit Trail</h2>
          <p>Transparent log of judge assignments, evaluation actions, voting schedules, and result releases.</p>
        </div>
      </div>

      <div className="audit-filter-bar">
        <label className="form-label" style={{ margin: 0 }}>Filter by Action:</label>
        <select
          className="form-input form-select"
          style={{ maxWidth: '240px' }}
          value={auditFilter}
          onChange={(e) => setAuditFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="judge.assigned">Judge assigned</option>
          <option value="judge.invited">Judge invited</option>
          <option value="judge.assignment_revoked">Judge assignment revoked</option>
          <option value="review.submitted">Review submitted</option>
          <option value="review.updated">Review updated</option>
          <option value="results.published">Results published</option>
          <option value="event.status_published">Event published</option>
          <option value="event.status_active">Event active</option>
          <option value="event.status_judging">Judging started</option>
          <option value="event.status_voting">Voting opened</option>
          <option value="event.status_ended">Event ended</option>
        </select>
      </div>

      {auditLoading ? (
        <div className="empty-loading-state">Loading audit logs…</div>
      ) : auditLogs.length ? (
        <div className="organizer-table">
          <div className="organizer-table-head audit-table-head">
            <span>Timestamp</span>
            <span>Action</span>
            <span>Actor</span>
            <span>Target / Project</span>
            <span>Details</span>
          </div>
          {auditLogs.map((log) => (
            <div className="organizer-table-row audit-table-row" key={log._id}>
              <span><small>{dateTime(log.createdAt)}</small></span>
              <span>
                <span className="judging-badge badge-neutral">
                  {formatAuditAction(log.action)}
                </span>
              </span>
              <span>
                <strong>{log.actor?.email || 'System'}</strong>
                {log.actor?.role && <span className="badge-role" style={{ marginLeft: '4px' }}>{log.actor.role}</span>}
              </span>
              <span>{log.project?.title || log.metadata?.projectTitle || '—'}</span>
              <span>
                <small style={{ color: 'var(--text-secondary)' }}>
                  {log.metadata?.trackName ? `Track: ${log.metadata.trackName}` : log.metadata?.judgeEmail ? `Judge: ${log.metadata.judgeEmail}` : 'Action logged'}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="organizer-empty-inline">No audit events match the selected filter.</p>
      )}
    </section>}

    {/* ========================================================
        Tab: Settings
        ======================================================== */}
    {tab.toLowerCase() === 'settings' && <section className="workspace-card organizer-settings-panel">
      <div className="organizer-section-heading"><h2>Event settings</h2>{!eventForm && <button className="btn-secondary btn-sm" onClick={openEventForm}>Edit Event</button>}</div>
      {eventForm && <form className="organizer-edit-form" onSubmit={saveEvent}><label className="form-group"><span className="form-label">Hackathon name</span><input className="form-input" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} minLength={2} required /></label><label className="form-group"><span className="form-label">Description</span><textarea className="form-input form-textarea" rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></label><label className="form-group"><span className="form-label">Status</span><select className="form-input form-select" value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}>{LIFECYCLE_STAGES.map((status) => <option key={status}>{status}</option>)}</select></label>{[['startDate', 'Start'], ['submissionDeadline', 'Submission deadline'], ['endDate', 'End']].map(([key, label]) => <label className="form-group" key={key}><span className="form-label">{label}</span><input type="datetime-local" className="form-input" value={eventForm[key]} onChange={(e) => setEventForm({ ...eventForm, [key]: e.target.value })} required /></label>)}<div className="organizer-inline-actions"><button className="btn-primary btn-sm"><Save size={14} /> Save event</button><button type="button" className="btn-secondary btn-sm" onClick={() => setEventForm(null)}>Cancel</button></div></form>}
      <section className="organizer-config-section"><div className="organizer-section-heading"><div><h3>Tracks</h3><p>Organize submissions into themes or categories.</p></div><button type="button" className="btn-secondary btn-sm" onClick={() => startItemEdit('tracks')}><Plus size={14} /> Add track</button></div>{(event.tracks || []).map((item) => <div className="organizer-setting-row" key={item._id}><span className="organizer-setting-copy"><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}</span><button type="button" className="organizer-edit-action" aria-label={`Edit track ${item.name}`} onClick={() => startItemEdit('tracks', item)}><Pencil size={14} /><span>Edit track</span></button></div>)}{!event.tracks?.length && <p className="text-muted-sm">No tracks configured.</p>}{itemForm?.kind === 'tracks' && renderItemForm()}</section>
      <section className="organizer-config-section"><div className="organizer-section-heading"><div><h3>Prizes</h3><p>Show participants what they can win.</p></div><button type="button" className="btn-secondary btn-sm" onClick={() => startItemEdit('prizes')}><Plus size={14} /> Add prize</button></div>{(event.prizes || []).map((item) => <div className="organizer-setting-row" key={item._id}><span className="organizer-setting-copy"><strong>{item.name}</strong><small>{[item.value, item.description].filter(Boolean).join(' · ') || 'Prize details not provided'}</small></span><button type="button" className="organizer-edit-action" aria-label={`Edit prize ${item.name}`} onClick={() => startItemEdit('prizes', item)}><Pencil size={14} /><span>Edit prize</span></button></div>)}{!event.prizes?.length && <p className="text-muted-sm">No prizes configured.</p>}{itemForm?.kind === 'prizes' && renderItemForm()}</section>
      <form className="organizer-edit-form organizer-voting-settings" onSubmit={saveVotingWindow}><h3>Community voting schedule</h3><div className="form-group"><label className="form-label" htmlFor="voting-open-at">Voting opens</label><span className="organizer-date-picker"><input id="voting-open-at" ref={votingOpenInput} type="datetime-local" className="form-input event-datetime-input" value={votingForm.votingOpenAt} onChange={(e) => setVotingForm({ ...votingForm, votingOpenAt: e.target.value })} /><button type="button" className="btn-secondary btn-sm" aria-label="Choose voting open date and time" onClick={() => { const input = votingOpenInput.current; if (input?.showPicker) input.showPicker(); else input?.focus(); }}><CalendarDays size={16} /></button></span></div><div className="form-group"><label className="form-label" htmlFor="voting-close-at">Voting closes</label><span className="organizer-date-picker"><input id="voting-close-at" ref={votingCloseInput} type="datetime-local" className="form-input event-datetime-input" value={votingForm.votingCloseAt} onChange={(e) => setVotingForm({ ...votingForm, votingCloseAt: e.target.value })} min={votingForm.votingOpenAt || undefined} /><button type="button" className="btn-secondary btn-sm" aria-label="Choose voting close date and time" onClick={() => { const input = votingCloseInput.current; if (input?.showPicker) input.showPicker(); else input?.focus(); }}><CalendarDays size={16} /></button></span></div><button className="btn-secondary btn-sm"><Save size={14} /> Save voting schedule</button></form>
      <p className="organizer-capability-note">Existing tracks and prizes can be edited. The current API does not support deleting them.</p>
    </section>}

    <ProjectDetailModal project={selectedProject} isOpen={Boolean(selectedProject)} onClose={() => setSelectedProject(null)} />

    {/* ========================================================
        Modal: Invite / Assign Judge
        ======================================================== */}
    {assignModalOpen && (
      <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
        <div className="organizer-modal-dialog">
          <div className="modal-header">
            <h3 id="assign-modal-title">Invite / Assign Judge</h3>
            <button className="modal-close-btn" onClick={() => setAssignModalOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {inviteSuccessInfo ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="judging-healthy-banner">
                <CheckCircle size={18} />
                <span>Judge invited successfully!</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Offline/Local shareable link for <strong>{inviteSuccessInfo.email}</strong>:
              </p>
              <input
                className="form-input"
                readOnly
                value={inviteSuccessInfo.inviteLink}
                onClick={(e) => e.target.select()}
              />
              <button className="btn-primary btn-sm" onClick={() => setAssignModalOpen(false)}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleAssignSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
              <div className="modal-mode-tabs">
                <button
                  type="button"
                  className={assignForm.mode === 'existing' ? 'active' : ''}
                  onClick={() => setAssignForm({ ...assignForm, mode: 'existing' })}
                >
                  Existing Judge
                </button>
                <button
                  type="button"
                  className={assignForm.mode === 'invite' ? 'active' : ''}
                  onClick={() => setAssignForm({ ...assignForm, mode: 'invite' })}
                >
                  Invite by Email
                </button>
              </div>

              {assignForm.mode === 'existing' ? (
                <label className="form-group">
                  <span className="form-label">Select Judge</span>
                  {availableJudges.length ? (
                    <select
                      className="form-input form-select"
                      value={assignForm.judgeId}
                      onChange={(e) => setAssignForm({ ...assignForm, judgeId: e.target.value })}
                      required
                    >
                      <option value="">Choose a judge...</option>
                      {availableJudges.map((j) => (
                        <option key={j._id} value={j._id}>
                          {j.name || j.email.split('@')[0]} ({j.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-muted-sm">
                      No unassigned judges found. Switch to <em>Invite by Email</em> to register a new judge.
                    </p>
                  )}
                </label>
              ) : (
                <>
                  <label className="form-group">
                    <span className="form-label">Judge Email</span>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="judge@example.com"
                      value={assignForm.email}
                      onChange={(e) => setAssignForm({ ...assignForm, email: e.target.value })}
                      required
                    />
                  </label>
                  <label className="form-group">
                    <span className="form-label">Full Name (optional)</span>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aarav Sharma"
                      value={assignForm.name}
                      onChange={(e) => setAssignForm({ ...assignForm, name: e.target.value })}
                    />
                  </label>
                </>
              )}

              <label className="form-group">
                <span className="form-label">Assign to Track</span>
                <select
                  className="form-input form-select"
                  value={assignForm.trackId}
                  onChange={(e) => setAssignForm({ ...assignForm, trackId: e.target.value })}
                >
                  <option value="">All Tracks</option>
                  {(event.tracks || []).map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <div className="form-group">
                <span className="form-label">Projects Scope</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer', marginBottom: '0.35rem' }}>
                  <input
                    type="radio"
                    name="projectScope"
                    checked={assignForm.assignedAll}
                    onChange={() => setAssignForm({ ...assignForm, assignedAll: true, projectIds: [] })}
                  />
                  <span>All submitted projects in this track</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="projectScope"
                    checked={!assignForm.assignedAll}
                    onChange={() => setAssignForm({ ...assignForm, assignedAll: false })}
                  />
                  <span>Select specific projects</span>
                </label>
              </div>

              {!assignForm.assignedAll && (
                <div className="project-checklist">
                  {projects.filter(p => p.status === 'submitted').map((p) => {
                    const isChecked = assignForm.projectIds.includes(p._id);
                    return (
                      <label key={p._id} className="project-check-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const nextIds = e.target.checked
                              ? [...assignForm.projectIds, p._id]
                              : assignForm.projectIds.filter(id => id !== p._id);
                            setAssignForm({ ...assignForm, projectIds: nextIds });
                          }}
                        />
                        <span>{p.title} <small>({p.teamId?.name || 'Independent'})</small></span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="organizer-inline-actions" style={{ marginTop: '0.5rem' }}>
                <button className="btn-primary btn-sm">
                  {assignForm.mode === 'invite' ? 'Send Invitation & Assign' : 'Confirm Assignment'}
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setAssignModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )}

    {/* ========================================================
        Modal: Publish Results Confirmation
        ======================================================== */}
    {publishModalOpen && (
      <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="publish-modal-title">
        <div className="organizer-modal-dialog">
          <div className="modal-header">
            <h3 id="publish-modal-title">Publish Hackathon Results</h3>
            <button className="modal-close-btn" onClick={() => setPublishModalOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0 }}>
              Publishing will make final project rankings visible to participants and the public.
            </p>

            <dl className="workspace-event-dates" style={{ margin: 0 }}>
              <dt>Submitted projects</dt>
              <dd>{projects.filter(p => p.status === 'submitted').length}</dd>
              <dt>Total reviews recorded</dt>
              <dd>{scores.length}</dd>
              <dt>Projects with warnings</dt>
              <dd>{judgingOverview?.attention?.insufficientReviews?.length || 0}</dd>
              <dt>Score discrepancies</dt>
              <dd>{judgingOverview?.attention?.discrepancies?.length || 0}</dd>
            </dl>

            {((judgingOverview?.attention?.insufficientReviews?.length || 0) > 0 ||
              (judgingOverview?.attention?.discrepancies?.length || 0) > 0) && (
              <div className="publish-warning-box">
                <strong>Attention: Unresolved evaluation warnings exist.</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>
                  There are {judgingOverview?.attention?.insufficientReviews?.length || 0} projects with fewer than 2 reviews and {judgingOverview?.attention?.discrepancies?.length || 0} score discrepancies &gt; 2.0.
                </p>
              </div>
            )}

            {((judgingOverview?.attention?.insufficientReviews?.length || 0) > 0 ||
              (judgingOverview?.attention?.discrepancies?.length || 0) > 0) && (
              <label className="publish-ack-label">
                <input
                  type="checkbox"
                  checked={publishAcknowledged}
                  onChange={(e) => setPublishAcknowledged(e.target.checked)}
                />
                <span>I acknowledge that there are unresolved score discrepancies or unreviewed submissions and wish to publish results.</span>
              </label>
            )}

            <div className="organizer-inline-actions" style={{ marginTop: '0.5rem' }}>
              <button
                className="btn-primary btn-sm"
                disabled={
                  publishSubmitting ||
                  (((judgingOverview?.attention?.insufficientReviews?.length || 0) > 0 ||
                    (judgingOverview?.attention?.discrepancies?.length || 0) > 0) &&
                    !publishAcknowledged)
                }
                onClick={handlePublishResults}
              >
                {publishSubmitting ? 'Publishing…' : 'Confirm & Publish Results'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setPublishModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ========================================================
        Modal: Bulk Data Import
        ======================================================== */}
    {importModalOpen && (
      <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
        <div className="organizer-modal-dialog">
          <div className="modal-header">
            <h3 id="import-modal-title">Bulk Import Hackathon Data</h3>
            <button className="modal-close-btn" onClick={() => setImportModalOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="verification-desc-box" style={{ margin: 0 }}>
              <h4>Step 1: Choose JSON File</h4>
              <p>Select a JSON file containing teams and projects to import.</p>
              <input
                type="file"
                accept=".json"
                className="form-input"
                style={{ marginTop: '0.5rem' }}
                onChange={handleFileSelected}
              />
            </div>

            {importValidating && (
              <div className="empty-loading-state">Validating records with server…</div>
            )}

            {importValidation && (
              <div>
                <h4 style={{ fontSize: '0.88rem', margin: '0 0 0.5rem' }}>Step 2: Validation Results</h4>
                <div className="validation-metrics-grid">
                  <div className="validation-metric-card">
                    <span className="validation-metric-num">{importValidation.projectsCount}</span>
                    <span className="validation-metric-label">Projects</span>
                  </div>
                  <div className="validation-metric-card">
                    <span className="validation-metric-num">{importValidation.teamsCount}</span>
                    <span className="validation-metric-label">Teams</span>
                  </div>
                  <div className="validation-metric-card">
                    <span className={`validation-metric-num ${importValidation.errors?.length ? 'error' : ''}`}>
                      {importValidation.errors?.length || 0}
                    </span>
                    <span className="validation-metric-label">Errors</span>
                  </div>
                </div>

                {importValidation.errors?.length > 0 && (
                  <div className="validation-error-list">
                    <strong>Validation Failed. Database was NOT modified:</strong>
                    <ul>
                      {importValidation.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importValidation.valid && importValidation.errors?.length === 0 && (
                  <div className="judging-healthy-banner" style={{ margin: '0.75rem 0' }}>
                    <CheckCircle size={16} />
                    <span>All records passed validation. Ready to commit transaction.</span>
                  </div>
                )}
              </div>
            )}

            <div className="organizer-inline-actions" style={{ marginTop: '0.5rem' }}>
              <button
                className="btn-primary btn-sm"
                disabled={!importValidation?.valid || importValidation?.errors?.length > 0 || importSubmitting}
                onClick={handleExecuteImport}
              >
                {importSubmitting ? 'Importing…' : 'Import'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setImportModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ========================================================
        Modal: Add Webhook
        ======================================================== */}
    {webhookModalOpen && (
      <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="webhook-modal-title">
        <div className="organizer-modal-dialog">
          <div className="modal-header">
            <h3 id="webhook-modal-title">Register Webhook Endpoint</h3>
            <button className="modal-close-btn" onClick={() => setWebhookModalOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreateWebhook} style={{ display: 'grid', gap: '0.9rem' }}>
            <label className="form-group">
              <span className="form-label">Target URL (HTTPS / HTTP)</span>
              <input
                type="url"
                className="form-input"
                placeholder="https://api.example.com/webhooks/hackhub"
                value={webhookForm.targetUrl}
                onChange={(e) => setWebhookForm({ ...webhookForm, targetUrl: e.target.value })}
                required
              />
            </label>

            <label className="form-group">
              <span className="form-label">Custom Secret (optional — generated automatically if blank)</span>
              <input
                type="text"
                className="form-input"
                placeholder="Leave empty for secure random generation"
                value={webhookForm.secret}
                onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                minLength={8}
              />
            </label>

            <div className="form-group">
              <span className="form-label">Subscribe to Events</span>
              <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.35rem' }}>
                {WEBHOOK_EVENTS_LIST.map((ev) => {
                  const isChecked = webhookForm.subscribedEvents.includes(ev.id);
                  return (
                    <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...webhookForm.subscribedEvents, ev.id]
                            : webhookForm.subscribedEvents.filter(id => id !== ev.id);
                          setWebhookForm({ ...webhookForm, subscribedEvents: next });
                        }}
                      />
                      <span>{ev.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="organizer-inline-actions" style={{ marginTop: '0.5rem' }}>
              <button
                className="btn-primary btn-sm"
                disabled={!webhookForm.targetUrl || webhookForm.subscribedEvents.length === 0}
              >
                Add Webhook
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setWebhookModalOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ========================================================
        Modal: Webhook Deliveries History
        ======================================================== */}
    {deliveriesModalWebhook && (
      <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="deliveries-modal-title">
        <div className="organizer-modal-dialog">
          <div className="modal-header">
            <h3 id="deliveries-modal-title">Webhook Delivery History</h3>
            <button className="modal-close-btn" onClick={() => setDeliveriesModalWebhook(null)}>
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            Endpoint: <code>{deliveriesModalWebhook.targetUrl}</code>
          </p>

          <div className="deliveries-list">
            {(deliveriesModalWebhook.recentDeliveries || []).length ? (
              deliveriesModalWebhook.recentDeliveries.map((dl, idx) => (
                <div className="delivery-item" key={idx}>
                  <div>
                    <span className={`judging-badge ${dl.success ? 'badge-success' : 'badge-warning'}`} style={{ marginRight: '0.5rem' }}>
                      {dl.statusCode || (dl.success ? 200 : 500)}
                    </span>
                    <strong>{dl.event}</strong>
                    {dl.error && <small style={{ display: 'block', color: '#dc2626' }}>{dl.error}</small>}
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>{dateTime(dl.timestamp)}</small>
                </div>
              ))
            ) : (
              <p className="organizer-empty-inline">No delivery records logged for this webhook yet.</p>
            )}
          </div>

          <div className="organizer-inline-actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn-secondary btn-sm" onClick={() => setDeliveriesModalWebhook(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    <CertificateModal
      isOpen={certModalOpen}
      onClose={() => setCertModalOpen(false)}
      certificate={selectedCert}
      eventId={eventId}
      recipientId={selectedCert?.recipientId}
      type={selectedCert?.type}
    />
  </div>;
}

function eventDateRange(event) {
  return `${dateTime(event.startDate)} · Deadline ${dateTime(event.submissionDeadline)}`;
}
