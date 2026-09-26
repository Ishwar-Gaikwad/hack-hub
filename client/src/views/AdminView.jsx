import React from 'react';
import { Shield, Terminal, ArrowRight } from 'lucide-react';

export default function AdminView({ onNavigate }) {
  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Admin & System</h1>
          <p className="page-description">Administrative portal and system management for HackHub.</p>
        </div>
        <span className="badge-tag" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          Admin
        </span>
      </div>

      <div className="workspace-layout">
        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '0.75rem' }}>Developer Tools & Diagnostics</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Access the technical verification suite, database status inspection, live API payload visualizer, and RBAC endpoint matrix.
          </p>
          <button className="btn-primary" onClick={() => onNavigate('developer')}>
            <Terminal size={15} />
            <span>Open Developer Diagnostics</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '0.75rem' }}>System Foundation</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            HackHub is running as a self-hosted platform with local persistent MongoDB storage and zero cloud lock-in.
          </p>
          <div className="text-muted-sm font-mono">Environment: Node.js / Express / Mongoose / Vite</div>
        </div>
      </div>
    </div>
  );
}
