import React, { useState, useEffect } from 'react';
import { Calendar, Search, ArrowRight, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EventDetailModal from '../components/EventDetailModal';

export default function EventsView({ onNavigate, onOpenAuth }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
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

  useEffect(() => {
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

  const filteredEvents = events.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-view-container">
      {/* Page Header */}
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Hackathons & Events</h1>
          <p className="page-description">
            Discover active hackathons, explore competitive tracks, review prize pools, and submit innovative projects before the submission deadline.
          </p>
        </div>

        {(currentUser?.role === 'organizer' || currentUser?.role === 'admin') && (
          <button
            className="btn-primary"
            onClick={() => onNavigate('organizer-workspace')}
          >
            <span>Create New Event</span>
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {/* Discovery / Search Bar */}
      <div className="filter-panel">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search events by name or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <button
            className="btn-secondary btn-sm"
            onClick={() => setSearchQuery('')}
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="empty-loading-state">Loading hackathon events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state-card">
          <Calendar size={40} color="var(--text-muted)" />
          <h3>No Matching Events Found</h3>
          <p>Try adjusting your search criteria or check back later for newly announced hackathons.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredEvents.map((evt) => {
            return (
              <div key={evt._id} className="event-card">
                <h2 className="event-card-title">{evt.name}</h2>
                <p className="event-card-desc">
                  {evt.description || 'No description provided.'}
                </p>

                <div className="event-pills-row">
                  <span className="event-meta-pill">
                    <Calendar size={12} color="#a78bfa" />
                    <span>{formatDate(evt.startDate)} – {formatDate(evt.endDate)}</span>
                  </span>
                  {evt.tracks?.length > 0 && (
                    <span className="event-meta-pill">
                      <Tag size={12} color="#a855f7" />
                      <span>{evt.tracks.length} {evt.tracks.length === 1 ? 'Track' : 'Tracks'}</span>
                    </span>
                  )}
                </div>

                <div className="event-card-footer">
                  <button
                    className="btn-secondary btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setSelectedEventId(evt._id)}
                  >
                    <span>View Hackathon</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Details Modal */}
      <EventDetailModal
        eventId={selectedEventId}
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        onNavigateToWorkspace={(eventId, teamId) => onNavigate('my-team', { eventId, teamId })}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
}
