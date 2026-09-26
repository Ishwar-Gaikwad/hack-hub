import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, ShieldAlert, CheckCircle2, Clock, Calendar, FileText } from 'lucide-react';

export default function JudgeDashboard({ onOpenAuth }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [eRes, pRes] = await Promise.all([
          fetch('/api/events'),
          fetch('/api/projects')
        ]);
        if (eRes.ok) {
          const eData = await eRes.json();
          setEvents(eData.events || []);
        }
        if (pRes.ok) {
          const pData = await pRes.json();
          setProjectsCount(pData.projects?.length || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchSummary();
  }, []);

  if (!currentUser || (currentUser.role !== 'judge' && currentUser.role !== 'admin')) {
    return (
      <div className="empty-state-card" style={{ padding: '3.5rem 1.5rem' }}>
        <Award size={48} color="var(--text-muted)" />
        <h2>Judge Access Required</h2>
        <p>You must be signed in with a Judge or Admin account to access the evaluation portal.</p>
        <button className="btn-primary" onClick={() => onOpenAuth('login')} style={{ marginTop: '1rem' }}>
          Sign In as Judge
        </button>
      </div>
    );
  }

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Judge Evaluation Portal</h1>
          <p className="page-description">
            Evaluate submitted hackathon solutions against structured rubric criteria and track guidelines.
          </p>
        </div>
        <div className="badge-tag" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
          Active Judge: {currentUser.email}
        </div>
      </div>

      <div className="workspace-layout">
        <div className="workspace-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header-styled">
            <Award size={22} color="#38bdf8" />
            <h2 className="card-heading">Tier 2 Scoring System (Upcoming)</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            The Tier 1 milestone establishes foundation models, team collaboration, and strict deadline submission validation. Comprehensive judging scorecards, rubric matrices, and randomized assignment workflows will be activated during Tier 2 implementation.
          </p>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Active Events</div>
              <div className="metric-value">{events.length}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Submitted Projects</div>
              <div className="metric-value">{projectsCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Judging Engine</div>
              <div className="metric-value" style={{ color: '#38bdf8', fontSize: '0.95rem' }}>
                Tier 2 Ready
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
