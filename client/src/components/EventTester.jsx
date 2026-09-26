import React, { useState, useEffect } from 'react';
import { Calendar, PlusCircle, Award, Tag, RefreshCw, ChevronRight } from 'lucide-react';

export default function EventTester() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [endDate, setEndDate] = useState('');

  // Track & Prize creation states
  const [trackName, setTrackName] = useState('');
  const [trackDesc, setTrackDesc] = useState('');
  const [prizeName, setPrizeName] = useState('');
  const [prizeValue, setPrizeValue] = useState('');

  const getToken = () => localStorage.getItem('hackhub_session_token') || '';

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.events && data.events.length > 0 && !selectedEvent) {
          fetchEventDetails(data.events[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventDetails = async (eventId) => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEvent(data.event);
      }
    } catch (err) {
      console.error('Failed to fetch event details:', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setMessage(null);
    const token = getToken();

    if (!token) {
      setMessage({ type: 'error', text: 'Authentication required. Please sign in as an organizer or admin in the section above.' });
      return;
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description,
          startDate: new Date(startDate).toISOString(),
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          endDate: new Date(endDate).toISOString(),
          status: 'published'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Event created: ${data.event.name}` });
        setName('');
        setDescription('');
        setStartDate('');
        setSubmissionDeadline('');
        setEndDate('');
        fetchEvents();
        fetchEventDetails(data.event._id);
      } else {
        setMessage({ type: 'error', text: data.message || `Error (${res.status}): ${data.error}` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreateTrack = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const token = getToken();

    try {
      const res = await fetch(`/api/events/${selectedEvent._id}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: trackName, description: trackDesc })
      });
      const data = await res.json();
      if (res.ok) {
        setTrackName('');
        setTrackDesc('');
        fetchEventDetails(selectedEvent._id);
      } else {
        setMessage({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCreatePrize = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    const token = getToken();

    try {
      const res = await fetch(`/api/events/${selectedEvent._id}/prizes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: prizeName, value: prizeValue })
      });
      const data = await res.json();
      if (res.ok) {
        setPrizeName('');
        setPrizeValue('');
        fetchEventDetails(selectedEvent._id);
      } else {
        setMessage({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="hero-card" style={{ marginTop: '2rem' }}>
      <div className="hero-header">
        <div className="hero-title">
          <Calendar size={24} color="#38bdf8" />
          <span>T1-03 Event Management, Tracks & Prizes</span>
        </div>
        <button className="btn-secondary" onClick={fetchEvents} disabled={loading} style={{ padding: '0.4rem 0.8rem' }}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh Events
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.75rem' }}>
        {/* Create Event Form */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Create Hackathon Event (Organizer / Admin)
          </div>
          <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <input
              type="text"
              placeholder="Event Name (e.g. HackAI 2026)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff'
              }}
            />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                padding: '0.6rem 0.8rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff'
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.75rem'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Submission Deadline</label>
                <input
                  type="datetime-local"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.75rem'
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>End Date</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.75rem'
                }}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <PlusCircle size={15} /> Create Event
            </button>
          </form>

          {message && (
            <div
              className={`status-pill ${message.type === 'success' ? 'healthy' : 'unhealthy'}`}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Event List & Inspector */}
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Events ({events.length})
          </div>
          {events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events created yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem' }}>
              {events.map((evt) => (
                <div
                  key={evt._id}
                  onClick={() => fetchEventDetails(evt._id)}
                  style={{
                    padding: '0.6rem 0.8rem',
                    background: selectedEvent?._id === evt._id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${selectedEvent?._id === evt._id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{evt.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {evt.status}</div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}

          {/* Selected Event Details (Tracks & Prizes) */}
          {selectedEvent && (
            <div className="metric-card" style={{ padding: '0.85rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#a5b4fc', marginBottom: '0.4rem' }}>
                {selectedEvent.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div><strong>Start:</strong> {new Date(selectedEvent.startDate).toLocaleString()}</div>
                <div><strong>Deadline:</strong> {new Date(selectedEvent.submissionDeadline).toLocaleString()}</div>
                <div><strong>End:</strong> {new Date(selectedEvent.endDate).toLocaleString()}</div>
              </div>

              {/* Tracks Section */}
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  <Tag size={13} color="#6366f1" /> Tracks ({selectedEvent.tracks?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                  {selectedEvent.tracks?.map((t) => (
                    <span key={t._id} className="badge-tag" style={{ fontSize: '0.7rem' }}>{t.name}</span>
                  ))}
                </div>
                <form onSubmit={handleCreateTrack} style={{ display: 'flex', gap: '0.3rem' }}>
                  <input
                    type="text"
                    placeholder="New track name"
                    value={trackName}
                    onChange={(e) => setTrackName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.75rem', background: '#090c12', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '4px' }}
                  />
                  <button type="submit" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+ Track</button>
                </form>
              </div>

              {/* Prizes Section */}
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  <Award size={13} color="#f59e0b" /> Prizes ({selectedEvent.prizes?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                  {selectedEvent.prizes?.map((p) => (
                    <span key={p._id} className="badge-tag" style={{ fontSize: '0.7rem', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                      {p.name} {p.value ? `(${p.value})` : ''}
                    </span>
                  ))}
                </div>
                <form onSubmit={handleCreatePrize} style={{ display: 'flex', gap: '0.3rem' }}>
                  <input
                    type="text"
                    placeholder="Prize name"
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.75rem', background: '#090c12', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. $5k)"
                    value={prizeValue}
                    onChange={(e) => setPrizeValue(e.target.value)}
                    style={{ width: '90px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', background: '#090c12', border: '1px solid var(--border-subtle)', color: '#fff', borderRadius: '4px' }}
                  />
                  <button type="submit" className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+ Prize</button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
