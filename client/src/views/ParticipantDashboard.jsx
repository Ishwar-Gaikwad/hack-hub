import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, CheckCircle2, ArrowRight, FolderGit2, Users } from 'lucide-react';

export default function ParticipantDashboard({ onNavigate }) {
  const { sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eRes, tRes] = await Promise.all([
          fetch('/api/events'),
          sessionToken ? fetch('/api/teams/my-teams', { headers: { Authorization: `Bearer ${sessionToken}` } }) : Promise.resolve({ ok: false })
        ]);

        let eventsList = [];
        if (eRes.ok) {
          const eData = await eRes.json();
          eventsList = eData.events || [];
          setEvents(eventsList);
        }

        if (tRes.ok) {
          const tData = await tRes.json();
          const teams = tData.teams || [];
          setMyTeams(teams);

          if (teams.length > 0) {
            // Check project for first team
            const pRes = await fetch(`/api/projects?teamId=${teams[0]._id}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.projects?.length > 0) {
                setActiveProject(pData.projects[0]);
              }
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionToken]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="empty-loading-state">Loading your dashboard...</div>;
  }

  const primaryEvent = events[0] || null;
  const primaryTeam = myTeams[0] || null;
  const isDeadlinePassed = primaryEvent?.submissionDeadline
    ? new Date(primaryEvent.submissionDeadline) < new Date()
    : false;

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Your current hackathon status and next action.</p>
        </div>
      </div>

      {/* Focus Action Card */}
      <div className="focus-dashboard-card">
        <div className="focus-header">
          <span className="focus-kicker">Current Hackathon</span>
          <h2 className="focus-event-name">{primaryEvent?.name || 'DOGFOOD 2026 Hackathon'}</h2>
        </div>

        <div className="focus-body">
          <div className="focus-item">
            <span className="focus-label">Team</span>
            <span className="focus-value">{primaryTeam?.name || 'No team yet'}</span>
          </div>

          <div className="focus-item">
            <span className="focus-label">Project</span>
            <span className="focus-value">{activeProject?.title || 'No project created'}</span>
          </div>

          <div className="focus-item">
            <span className="focus-label">Status</span>
            <span className="focus-value">
              {activeProject ? (
                <span className={`badge-tag ${activeProject.status === 'submitted' ? 'badge-submitted' : 'badge-draft'}`}>
                  {activeProject.status === 'submitted' ? 'SUBMITTED' : 'DRAFT'}
                </span>
              ) : (
                <span className="badge-tag">NOT STARTED</span>
              )}
            </span>
          </div>

          <div className="focus-item">
            <span className="focus-label">Submission Deadline</span>
            <span className="focus-value font-mono">
              {formatDate(primaryEvent?.submissionDeadline)}
            </span>
          </div>
        </div>

        <div className="focus-action-row">
          {!primaryTeam ? (
            <button
              className="btn-primary btn-lg"
              onClick={() => onNavigate('my-team')}
            >
              <Users size={16} />
              <span>Create or Join a Team</span>
            </button>
          ) : !activeProject ? (
            <button
              className="btn-primary btn-lg"
              onClick={() => onNavigate('my-project')}
            >
              <FolderGit2 size={16} />
              <span>Start Project Draft</span>
            </button>
          ) : activeProject.status === 'draft' ? (
            <button
              className="btn-primary btn-lg"
              onClick={() => onNavigate('my-project')}
            >
              <FolderGit2 size={16} />
              <span>Continue Project Submission</span>
            </button>
          ) : (
            <button
              className="btn-secondary btn-lg"
              onClick={() => onNavigate('my-project')}
            >
              <CheckCircle2 size={16} color="#10b981" />
              <span>View Submitted Project</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
