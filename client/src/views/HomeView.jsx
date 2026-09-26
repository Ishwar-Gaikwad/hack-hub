import React, { useState, useEffect } from 'react';
import { Calendar, ArrowRight, Clock } from 'lucide-react';
import EventDetailModal from '../components/EventDetailModal';

export default function HomeView({ onNavigate, onOpenAuth }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="home-minimal-view">
      {/* Introduction & Primary CTA */}
      <section className="home-intro-section">
        <h1 className="home-headline">
          Self-hostable hackathon management platform with zero external dependencies.
        </h1>
        <div className="home-cta-row">
          <button
            className="btn-primary btn-lg"
            onClick={() => onNavigate('hackathons')}
          >
            <Calendar size={18} />
            <span>Browse Hackathons</span>
          </button>
        </div>
      </section>

      {/* Active & Upcoming Hackathons List */}
      <section className="home-events-section">
        <div className="section-header-simple">
          <h2 className="section-heading-sm">Active & Upcoming Hackathons</h2>
        </div>

        {loading ? (
          <div className="empty-loading-state">Loading hackathons...</div>
        ) : events.length === 0 ? (
          <div className="empty-state-card">
            <p>No active hackathons scheduled at this time.</p>
          </div>
        ) : (
          <div className="events-simple-list">
            {events.map((evt) => {
              const isExpired = evt.submissionDeadline && new Date(evt.submissionDeadline) < new Date();
              return (
                <div
                  key={evt._id}
                  className="event-simple-item"
                  onClick={() => setSelectedEventId(evt._id)}
                >
                  <div className="event-simple-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 className="event-simple-title">{evt.name}</h3>
                      <span className={`badge-tag ${isExpired ? 'badge-ended' : 'badge-active'}`}>
                        {isExpired ? 'Ended' : (evt.status || 'Active')}
                      </span>
                    </div>
                    <p className="event-simple-desc">{evt.description}</p>
                  </div>
                  <div className="event-simple-aside">
                    <div className="event-timeline-badge">
                      <Clock size={13} />
                      <span>Deadline: {formatDate(evt.submissionDeadline)}</span>
                    </div>
                    <button className="btn-secondary btn-sm">
                      <span>View</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <EventDetailModal
        eventId={selectedEventId}
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        onNavigateToWorkspace={() => onNavigate('dashboard')}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
}
