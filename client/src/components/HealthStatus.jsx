import React, { useState, useEffect } from 'react';
import { Activity, Database, Clock, Server, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function HealthStatus() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Unable to connect to backend server');
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const isHealthy = healthData && healthData.status === 'healthy';

  return (
    <div className="hero-card">
      <div className="hero-header">
        <div className="hero-title">
          <Activity size={24} color="#6366f1" />
          <span>Application & Database Foundation Status</span>
        </div>
        <div className="actions-bar">
          {healthData && (
            <div className={`status-pill ${isHealthy ? 'healthy' : 'unhealthy'}`}>
              <span className="pulse-dot"></span>
              <span>{healthData.status}</span>
            </div>
          )}
          <button 
            id="refresh-health-btn"
            className="btn-secondary" 
            onClick={fetchHealth} 
            disabled={loading}
            title="Refresh Health Status"
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>{loading ? 'Checking...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="status-pill unhealthy" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>
          <XCircle size={20} />
          <span>Server Offline: {error}</span>
        </div>
      ) : (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={15} /> System Status
            </div>
            <div className="metric-value" style={{ color: isHealthy ? '#10b981' : '#ef4444' }}>
              {isHealthy ? 'Operational' : 'Degraded'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={15} /> Database Engine
            </div>
            <div className="metric-value">
              {healthData?.database?.status || 'Disconnected'}
            </div>
            {healthData?.database?.name && (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                DB: {healthData.database.name}
              </span>
            )}
          </div>

          <div className="metric-card">
            <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={15} /> Server Uptime
            </div>
            <div className="metric-value">
              {formatUptime(healthData?.uptime)}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Environment</div>
            <div className="metric-value" style={{ textTransform: 'capitalize' }}>
              {healthData?.environment || 'development'}
            </div>
          </div>
        </div>
      )}

      {healthData && (
        <div>
          <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Response Payload (GET /api/health)
            </span>
            {lastChecked && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last checked: {lastChecked}
              </span>
            )}
          </div>
          <pre className="json-container">
            <code>{JSON.stringify(healthData, null, 2)}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
