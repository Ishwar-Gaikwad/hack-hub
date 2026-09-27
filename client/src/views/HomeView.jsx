import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import EventDetailModal from '../components/EventDetailModal';

export default function HomeView({ onNavigate, onOpenAuth }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const heroRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = null;

    const updateProgress = () => {
      frame = null;
      if (reducedMotion.matches) {
        hero.style.setProperty('--hero-scroll-progress', '0');
        return;
      }

      const { top, height } = hero.getBoundingClientRect();
      const range = Math.max(window.innerHeight + height, 1);
      const progress = Math.min(1, Math.max(0, (window.innerHeight - top) / range));
      hero.style.setProperty('--hero-scroll-progress', progress.toFixed(3));
    };

    const requestProgressUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateProgress);
    };

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        window.removeEventListener('scroll', requestProgressUpdate);
        window.removeEventListener('resize', requestProgressUpdate);
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        hero.style.setProperty('--hero-scroll-progress', '0');
        return;
      }

      window.addEventListener('scroll', requestProgressUpdate, { passive: true });
      window.addEventListener('resize', requestProgressUpdate);
      requestProgressUpdate();
    };

    handleMotionPreference();
    reducedMotion.addEventListener('change', handleMotionPreference);

    return () => {
      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      reducedMotion.removeEventListener('change', handleMotionPreference);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

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
      <section className="home-intro-section" ref={heroRef}>
        <span className="home-hero-wordmark" aria-hidden="true">HACKHUB</span>
        <div className="home-hero-content">
          <span className="home-eyebrow">Open source · Self-hosted</span>
          <h1 className="home-headline">
            Build. <span className="home-headline-accent">Judge.</span> Ship.
          </h1>
          <p className="home-subheadline">
            A self-hostable hackathon platform to bring event organizers, participants, and judges through the full journey—from kickoff to results.
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
