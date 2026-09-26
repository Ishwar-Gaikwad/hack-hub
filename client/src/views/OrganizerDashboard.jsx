import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, PlusCircle, Tag, Award, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function OrganizerDashboard({ onOpenAuth }) {
  const { currentUser, sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);

  // New Event form
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [endDate, setEndDate] = useState('');

  // Track & Prize form
  const [trackName, setTrackName] = useState('');
  const [trackDesc, setTrackDesc] = useState('');
  const [prizeName, setPrizeName] = useState('');
  const [prizeValue, setPrizeValue] = useState('');
  const [prizeDesc, setPrizeDesc] = useState('');

  // Messages & Loading
  const [eventMsg, setEventMsg] = useState(null);
  const [trackMsg, setTrackMsg] = useState(null);
  const [prizeMsg, setPrizeMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.events?.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0]._id);
          fetchEventDetails(data.events[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchEventDetails = async (eventId) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}`);
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

  if (!currentUser || (currentUser.role !== 'organizer' && currentUser.role !== 'admin')) {
    return (
      <div className="empty-state-card" style={{ padding: '3.5rem 1.5rem' }}>
        <Calendar size={48} color="var(--text-muted)" />
        <h2>Organizer Authorization Required</h2>
        <p>You must be signed in with an Organizer or Admin account to create and manage hackathons.</p>
        <button className="btn-primary" onClick={() => onOpenAuth('login')} style={{ marginTop: '1rem' }}>
          Sign In as Organizer
        </button>
      </div>
    );
  }

  // Create Event
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setEventMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: eventName.trim(),
          description: eventDesc.trim(),
          startDate: new Date(startDate).toISOString(),
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          endDate: new Date(endDate).toISOString(),
          status: 'published'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setEventMsg({ type: 'success', text: `Event "${data.event.name}" published successfully!` });
        setEventName('');
        setEventDesc('');
        setStartDate('');
        setSubmissionDeadline('');
        setEndDate('');
        fetchEvents();
        setSelectedEventId(data.event._id);
      } else {
        setEventMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setEventMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Create Track
  const handleCreateTrack = async (e) => {
    e.preventDefault();
    setTrackMsg(null);
    if (!selectedEventId || !trackName.trim()) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: trackName.trim(),
          description: trackDesc.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTrackMsg({ type: 'success', text: `Track "${data.track.name}" created!` });
        setTrackName('');
        setTrackDesc('');
        fetchEventDetails(selectedEventId);
      } else {
        setTrackMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setTrackMsg({ type: 'error', text: err.message });
    }
  };

  // Create Prize
  const handleCreatePrize = async (e) => {
    e.preventDefault();
    setPrizeMsg(null);
    if (!selectedEventId || !prizeName.trim()) return;

    try {
      const res = await fetch(`/api/events/${selectedEventId}/prizes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          name: prizeName.trim(),
          value: prizeValue.trim(),
          description: prizeDesc.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPrizeMsg({ type: 'success', text: `Prize "${data.prize.name}" created!` });
        setPrizeName('');
        setPrizeValue('');
        setPrizeDesc('');
        fetchEventDetails(selectedEventId);
      } else {
        setPrizeMsg({ type: 'error', text: data.message || data.error });
      }
    } catch (err) {
      setPrizeMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Organizer Hub</h1>
          <p className="page-description">
            Create and configure hackathon timelines, define competition tracks, and announce prize structures with automated deadline enforcement.
          </p>
        </div>
      </div>

      <div className="workspace-layout">
        {/* Create New Event */}
        <div className="workspace-card">
          <div className="card-header-styled">
            <PlusCircle size={20} color="#f59e0b" />
            <h2 className="card-heading">1. Create New Hackathon</h2>
          </div>

          {eventMsg && (
            <div className={`alert-box ${eventMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '1rem' }}>
              {eventMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{eventMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateEvent} className="form-group-block">
            <div className="form-group">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. AI Innovation Challenge 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Description</label>
              <textarea
                className="form-input form-textarea"
                rows={3}
                placeholder="Detailed objectives, criteria, and themes..."
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Start Date & Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#ec4899', fontWeight: 600 }}>
                Submission Deadline (Strict Server Enforcement)
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event End Date & Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              <PlusCircle size={16} /> Publish Hackathon Event
            </button>
          </form>
        </div>

        {/* Tracks & Prizes Management */}
        <div className="workspace-card">
          <div className="card-header-styled">
            <Tag size={20} color="#a855f7" />
            <h2 className="card-heading">2. Tracks & Prizes Management</h2>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Select Active Event to Manage</label>
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

          {/* Add Track Form */}
          <form onSubmit={handleCreateTrack} className="form-group-block" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Tag size={14} color="#a855f7" /> Add Competition Track
            </label>
            {trackMsg && (
              <div className={`alert-box ${trackMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '0.5rem' }}>
                <span>{trackMsg.text}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Track Name (e.g. Autonomous Agents)"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                required
              />
              <input
                type="text"
                className="form-input"
                placeholder="Track Description..."
                value={trackDesc}
                onChange={(e) => setTrackDesc(e.target.value)}
              />
              <button type="submit" className="btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                Add Track
              </button>
            </div>
          </form>

          {/* Add Prize Form */}
          <form onSubmit={handleCreatePrize} className="form-group-block">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={14} color="#f59e0b" /> Add Event Prize
            </label>
            {prizeMsg && (
              <div className={`alert-box ${prizeMsg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: '0.5rem' }}>
                <span>{prizeMsg.text}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Prize Title (e.g. 1st Place)"
                  value={prizeName}
                  onChange={(e) => setPrizeName(e.target.value)}
                  style={{ flex: 2 }}
                  required
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Value (e.g. $10,000)"
                  value={prizeValue}
                  onChange={(e) => setPrizeValue(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Prize Description..."
                value={prizeDesc}
                onChange={(e) => setPrizeDesc(e.target.value)}
              />
              <button type="submit" className="btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                Add Prize
              </button>
            </div>
          </form>

          {/* Current Event Summary */}
          {selectedEvent && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Configured Tracks ({selectedEvent.tracks?.length || 0}) & Prizes ({selectedEvent.prizes?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {selectedEvent.tracks?.map((tr) => (
                  <span key={tr._id} className="badge-tag" style={{ color: '#a855f7' }}>
                    Track: {tr.name}
                  </span>
                ))}
                {selectedEvent.prizes?.map((pz) => (
                  <span key={pz._id} className="badge-tag" style={{ color: '#f59e0b' }}>
                    Prize: {pz.name} ({pz.value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
