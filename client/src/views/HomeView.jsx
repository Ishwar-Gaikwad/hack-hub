import React, { useState, useEffect } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
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
      {/* Public product introduction and primary action */}
      <section className="home-intro-section">
        <div className="home-hero-content">
          <span className="home-eyebrow">Self-hosted hackathon management</span>
          <h1 className="home-headline">
            The whole hackathon, from kickoff to showcase.
          </h1>
          <p className="home-subheadline">
            From event setup and team formation to project submissions and judging, HackHub brings participants, judges, and organizers through the full lifecycle on infrastructure you control.
          </p>
          <div className="home-cta-row">
            <button
              className="btn-primary btn-lg"
              onClick={() => onNavigate('hackathons')}
            >
              <span>Browse Hackathons</span>
              <ArrowRight size={17} />
            </button>
          </div>
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
