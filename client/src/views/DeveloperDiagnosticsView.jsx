import React from 'react';
import HealthStatus from '../components/HealthStatus';
import AuthTester from '../components/AuthTester';
import EventTester from '../components/EventTester';
import TeamTester from '../components/TeamTester';
import ProjectTester from '../components/ProjectTester';
import GalleryTester from '../components/GalleryTester';
import { Terminal, ShieldCheck, Check, Activity } from 'lucide-react';

export default function DeveloperDiagnosticsView() {
  return (
    <div className="page-view-container">
      {/* Developer Diagnostics Banner */}
      <div className="diagnostics-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="icon-badge" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
            <Terminal size={22} color="#818cf8" />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.4rem' }}>
              Developer Diagnostics & T1 Acceptance Testing
            </h1>
            <p className="page-description" style={{ fontSize: '0.85rem' }}>
              Low-level component inspection and live API endpoint verification harnesses for DOGFOOD acceptance testing.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Health & Database Foundation Status */}
      <HealthStatus />

      {/* 2. Public Project Gallery Tester */}
      <GalleryTester />

      {/* 3. Auth & RBAC Verification */}
      <AuthTester />

      {/* 4. Event Management Tester */}
      <EventTester />

      {/* 5. Team Formation Tester */}
      <TeamTester />

      {/* 6. Project Submission Tester */}
      <ProjectTester />

      {/* Foundation & Architecture Overview */}
      <div className="checklist-section" style={{ marginTop: '2rem' }}>
        <div className="checklist-card">
          <h2 className="checklist-title">
            <ShieldCheck size={20} color="#6366f1" />
            <span>T1-01 Verified Technical Foundation</span>
          </h2>
          <div>
            <div className="check-item">
              <Check size={16} className="check-icon" />
              <span>Deterministic Express application startup and graceful shutdown</span>
            </div>
            <div className="check-item">
              <Check size={16} className="check-icon" />
              <span>Local MongoDB database connectivity and status inspection</span>
            </div>
            <div className="check-item">
              <Check size={16} className="check-icon" />
              <span>Standardized Health endpoint at <code>/health</code> & <code>/api/health</code></span>
            </div>
            <div className="check-item">
              <Check size={16} className="check-icon" />
              <span>Zero cloud dependency, zero external API runtime lock-in</span>
            </div>
          </div>
        </div>

        <div className="checklist-card">
          <h2 className="checklist-title">
            <Terminal size={20} color="#8b5cf6" />
            <span>Self-Hosted Deployment</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Start the full-stack containerized environment locally with:
            </p>
            <pre className="json-container" style={{ margin: 0, padding: '0.75rem 1rem' }}>
              <code>docker compose up</code>
            </pre>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Or run locally with <code>npm run dev</code> for server and client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
