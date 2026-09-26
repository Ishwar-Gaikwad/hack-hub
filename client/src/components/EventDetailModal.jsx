import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Award, Tag, Users, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function EventDetailModal({ eventId, isOpen, onClose, onNavigateToWorkspace, onOpenAuth }) {
  const { currentUser } = useAuth();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !eventId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setEventData(data.event);
        } else {
          setError('Failed to load event details');
        }
      } catch (err) {
        setError(err.message || 'Connection error');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [eventId, isOpen]);

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isDeadlinePassed = eventData?.submissionDeadline
    ? new Date(eventData.submissionDeadline) < new Date()
    : false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span className={`badge-tag ${isDeadlinePassed ? 'badge-ended' : 'badge-active'}`}>
                {isDeadlinePassed ? 'Submissions Closed' : (eventData?.status || 'Active')}
              </span>
            </div>
            <h2 className="modal-title">{eventData?.name || 'Event Details'}</h2>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="empty-loading-state">Loading event information...</div>
        ) : error ? (
          <div className="alert-box error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : eventData ? (
          <div className="modal-body-content">
            {/* Description */}
            <p className="event-full-description">
              {eventData.description || 'No detailed description provided for this hackathon.'}
            </p>

            {/* Timeline Bar */}
            <div className="timeline-grid">
              <div className="timeline-card">
                <span className="timeline-label">Event Starts</span>
                <span className="timeline-value">{formatDate(eventData.startDate)}</span>
              </div>
              <div className={`timeline-card ${isDeadlinePassed ? 'expired' : 'highlight'}`}>
                <span className="timeline-label">Submission Deadline</span>
                <span className="timeline-value">{formatDate(eventData.submissionDeadline)}</span>
                {isDeadlinePassed && (
                  <span className="timeline-subtext">Deadline Passed</span>
                )}
              </div>
              <div className="timeline-card">
                <span className="timeline-label">Event Concludes</span>
                <span className="timeline-value">{formatDate(eventData.endDate)}</span>
              </div>
            </div>

            {/* Tracks Section */}
            <div className="detail-section">
              <h3 className="section-subtitle">
                <Tag size={16} color="#a855f7" />
                <span>Competition Tracks ({eventData.tracks?.length || 0})</span>
              </h3>
              {eventData.tracks && eventData.tracks.length > 0 ? (
                <div className="cards-subgrid">
                  {eventData.tracks.map((track) => (
                    <div key={track._id} className="subcard">
                      <div className="subcard-title">{track.name}</div>
                      <p className="subcard-desc">{track.description || 'General track participation.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-sm">No specialized tracks configured for this event.</p>
              )}
            </div>

            {/* Prizes Section */}
            <div className="detail-section">
              <h3 className="section-subtitle">
                <Award size={16} color="#f59e0b" />
                <span>Prizes & Awards ({eventData.prizes?.length || 0})</span>
              </h3>
              {eventData.prizes && eventData.prizes.length > 0 ? (
                <div className="cards-subgrid">
                  {eventData.prizes.map((prize) => (
                    <div key={prize._id} className="subcard prize-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="subcard-title">{prize.name}</div>
                        {prize.value && <span className="prize-value-tag">{prize.value}</span>}
                      </div>
                      <p className="subcard-desc">{prize.description || 'Awarded based on merit.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-sm">No prize categories announced yet.</p>
              )}
            </div>

            {/* Action Footer */}
            <div className="modal-actions-footer">
              <button className="btn-secondary" onClick={onClose}>
                Close
              </button>
              {currentUser ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    onClose();
                    onNavigateToWorkspace(eventData._id);
                  }}
                >
                  <span>Go to Participant Workspace</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => {
                    onClose();
                    onOpenAuth('register');
                  }}
                >
                  <span>Sign In to Participate</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
