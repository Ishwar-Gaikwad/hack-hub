import React from 'react';
import HealthStatus from './components/HealthStatus';
import { Layers, ShieldCheck, Check, Terminal, Cpu } from 'lucide-react';

export default function App() {
  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Layers size={28} color="#ffffff" />
          </div>
          <div>
            <h1 className="brand-title">HackHub</h1>
            <div className="brand-subtitle">
              <span>MERN Hackathon Management Platform</span>
              <span className="badge-tag">T1-01 Foundation</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge-tag" style={{ color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
            Self-Hostable
          </span>
          <span className="badge-tag" style={{ color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)' }}>
            Zero External API
          </span>
        </div>
      </header>

      {/* Main Health & Persistence Status */}
      <main>
        <HealthStatus />

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
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>HackHub &bull; DOGFOOD 2026 Hackathon Platform &bull; T1-01 Application Foundation</p>
      </footer>
    </div>
  );
}
