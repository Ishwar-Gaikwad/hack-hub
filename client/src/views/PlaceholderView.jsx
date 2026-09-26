import React from 'react';
import { Clock, Award, Shield } from 'lucide-react';

export default function PlaceholderView({ title, description, badge = 'Tier 2 Scheduled' }) {
  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="badge-tag" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
          {badge}
        </div>
      </div>

      <div className="empty-state-card" style={{ padding: '3.5rem 2rem' }}>
        <Clock size={40} color="var(--text-muted)" />
        <h2>{title} Workflow</h2>
        <p>
          This capability is part of the Tier 2 roadmap. The navigation structure is established in Tier 1 for seamless role routing.
        </p>
      </div>
    </div>
  );
}
