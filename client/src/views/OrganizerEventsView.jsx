import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Tag, Award, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OrganizerEventsView() {
  const { sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);

  // New Event
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [endDate, setEndDate] = useState('');

  // Track & Prize
  const [trackName, setTrackName] = useState('');
  const [trackDesc, setTrackDesc] = useState('');
  const [prizeName, setPrizeName] = useState('');
  const [prizeValue, setPrizeValue] = useState('');

  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        const evts = data.events || [];
        setEvents(evts);
        if (evts.length > 0 && !selectedEventId) {
          setSelectedEventId(evts[0]._id);
          fetchEventDetails(evts[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchEventDetails = async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/events/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEvent(data.event);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchEventDetails(selectedEventId);
    }
  }, [selectedEventId]);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          startDate: new Date(startDate).toISOString(),
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          endDate: new Date(endDate).toISOString(),
          status: 'published'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `Event "${data.event.name}" published!` });
        setName('');
        setDescription('');
        setStartDate('');
        setSubmissionDeadline('');
        setEndDate('');
        fetchEvents();
        setSelectedEventId(data.event._id);
      } else {
        setMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrack = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!selectedEventId || !trackName.trim()) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ name: trackName.trim(), description: trackDesc.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `Track "${data.track.name}" created!` });
        setTrackName('');
        setTrackDesc('');
        fetchEventDetails(selectedEventId);
      } else {
        setMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreatePrize = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (!selectedEventId || !prizeName.trim()) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/prizes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ name: prizeName.trim(), value: prizeValue.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `Prize "${data.prize.name}" added!` });
        setPrizeName('');
        setPrizeValue('');
        fetchEventDetails(selectedEventId);
      } else {
        setMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">My Events</h1>
          <p className="page-description">Create hackathon timelines, configure competition tracks, and set prizes.</p>
        </div>
      </div>

      {msg && (
        <div className={`alert-box ${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="workspace-layout">
        {/* Create Event */}
        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '1rem' }}>Create Event</h2>
          <form onSubmit={handleCreateEvent} className="form-group-block">
            <div className="form-group">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AI Grand Prix 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#ec4899' }}>Submission Deadline</label>
              <input
                type="datetime-local"
                className="form-input"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              <PlusCircle size={15} />
              <span>Publish Event</span>
            </button>
          </form>
        </div>

        {/* Tracks & Prizes */}
        <div className="workspace-card">
          <h2 className="card-heading" style={{ marginBottom: '1rem' }}>Tracks & Prizes</h2>

          <div className="form-group">
            <label className="form-label">Select Event</label>
            <select
              className="form-input form-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.map((evt) => (
                <option key={evt._id} value={evt._id}>{evt.name}</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleCreateTrack} style={{ marginTop: '1.25rem' }}>
            <label className="form-label">Add Track</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Track name..."
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                required
              />
              <button type="submit" className="btn-secondary btn-sm">Add</button>
            </div>
          </form>

          <form onSubmit={handleCreatePrize} style={{ marginTop: '1.25rem' }}>
            <label className="form-label">Add Prize</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Prize name..."
                value={prizeName}
                onChange={(e) => setPrizeName(e.target.value)}
                style={{ flex: 2 }}
                required
              />
              <input
                type="text"
                className="form-input"
                placeholder="Value..."
                value={prizeValue}
                onChange={(e) => setPrizeValue(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-secondary btn-sm">Add</button>
            </div>
          </form>

          {selectedEvent && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div className="text-muted-xs" style={{ marginBottom: '0.4rem', fontWeight: 600 }}>
                Configured Tracks ({selectedEvent.tracks?.length || 0}) & Prizes ({selectedEvent.prizes?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {selectedEvent.tracks?.map((t) => (
                  <span key={t._id} className="badge-tag">Track: {t.name}</span>
                ))}
                {selectedEvent.prizes?.map((p) => (
                  <span key={p._id} className="badge-tag" style={{ color: '#f59e0b' }}>Prize: {p.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
