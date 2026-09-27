import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PlusCircle, Tag, Award, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OrganizerEventsView() {
  const { currentUser, sessionToken } = useAuth();
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
  const [dateError, setDateError] = useState('');
  const [loading, setLoading] = useState(false);

  const openDatePicker = (event) => {
    if (typeof event.currentTarget.showPicker === 'function') {
      try {
        event.currentTarget.showPicker();
      } catch {
        // The input remains editable if the browser does not allow a programmatic picker.
      }
    }
  };

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

    if (name.trim().length < 2) {
      setMsg({ type: 'error', text: 'Enter an event name with at least 2 characters.' });
      return;
    }

    if (!startDate || !submissionDeadline || !endDate) {
      setDateError('Choose a start date, submission deadline, and end date to continue.');
      return;
    }

    const startTime = new Date(startDate).getTime();
    const deadlineTime = new Date(submissionDeadline).getTime();
    const endTime = new Date(endDate).getTime();

    if (![startTime, deadlineTime, endTime].every(Number.isFinite)) {
      setDateError('Enter valid dates and times for the full event timeline.');
      return;
    }

    if (startTime > deadlineTime) {
      setDateError('The start date and time must be on or before the submission deadline.');
      return;
    }

    if (deadlineTime > endTime) {
      setDateError('The submission deadline must be on or before the event end date.');
      return;
    }

    setDateError('');
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
        setDateError('');
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

  if (currentUser?.role !== 'organizer') {
    return (
      <div className="empty-state-card organizer-access-message" role="status">
        <h1>Organizer access required</h1>
        <p>Sign in with an organizer account to create and manage events.</p>
      </div>
    );
  }

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
          <p className="page-description">Create an event, set its timeline, then add tracks and prizes.</p>
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
        <section className="workspace-card event-creation-card">
          <div className="event-card-heading">
            <h2 className="card-heading">Create Event</h2>
            <p className="event-section-help">Start with the event details and schedule.</p>
          </div>
          <form onSubmit={handleCreateEvent} className="event-create-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="event-name">Event name</label>
              <input
                id="event-name"
                type="text"
                className="form-input"
                placeholder="e.g. AI Grand Prix 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group event-description-group">
              <label className="form-label" htmlFor="event-description">Description <span className="optional-label">Optional</span></label>
              <textarea
                id="event-description"
                className="form-input form-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <section className="event-timeline-section" aria-labelledby="event-timeline-title">
              <div className="event-timeline-heading">
                <div>
                  <h3 id="event-timeline-title">Event timeline</h3>
                  <p>All times use your local time zone.</p>
                </div>
              </div>

              <div className="event-timeline-fields">
                <div className="form-group date-time-field">
                  <label className="form-label" htmlFor="event-start-date">Start date and time</label>
                  <p id="event-start-help" className="date-field-help">When the hackathon begins.</p>
                  <input
                    id="event-start-date"
                    type="datetime-local"
                    className="form-input event-datetime-input"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setDateError(''); }}
                    onClick={openDatePicker}
                    aria-describedby="event-start-help"
                    required
                  />
                </div>

                <div className="form-group date-time-field">
                  <label className="form-label" htmlFor="event-submission-deadline">Submission deadline</label>
                  <p id="event-deadline-help" className="date-field-help">After this time, participants can no longer submit.</p>
                  <input
                    id="event-submission-deadline"
                    type="datetime-local"
                    className="form-input event-datetime-input deadline-input"
                    value={submissionDeadline}
                    onChange={(e) => { setSubmissionDeadline(e.target.value); setDateError(''); }}
                    onClick={openDatePicker}
                    aria-describedby="event-deadline-help"
                    required
                  />
                </div>

                <div className="form-group date-time-field">
                  <label className="form-label" htmlFor="event-end-date">End date and time</label>
                  <p id="event-end-help" className="date-field-help">When the hackathon concludes.</p>
                  <input
                    id="event-end-date"
                    type="datetime-local"
                    className="form-input event-datetime-input"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setDateError(''); }}
                    onClick={openDatePicker}
                    aria-describedby="event-end-help"
                    required
                  />
                </div>
              </div>

              {dateError && <p className="event-date-error" role="alert">{dateError}</p>}
            </section>

            <button type="submit" className="btn-primary event-publish-button" disabled={loading}>
              <PlusCircle size={15} />
              <span>{loading ? 'Publishing…' : 'Publish Event'}</span>
            </button>
          </form>
        </section>

        {/* Tracks & Prizes */}
        <section className="workspace-card event-configuration-card">
          <div className="event-card-heading">
            <h2 className="card-heading">Tracks &amp; Prizes</h2>
            <p className="event-section-help">Configure what teams can build and what they can win.</p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="configure-event">Select event</label>
            <select
              id="configure-event"
              className="form-input form-select"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              {events.length === 0 && <option value="">Create an event first</option>}
              {events.map((evt) => (
                <option key={evt._id} value={evt._id}>{evt.name}</option>
              ))}
            </select>
          </div>

          <form onSubmit={handleCreateTrack} className="event-config-form">
            <label className="form-label" htmlFor="new-track-name">Add track</label>
            <div className="event-config-input-row">
              <input
                id="new-track-name"
                type="text"
                className="form-input"
                placeholder="Track name..."
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                required
              />
              <button type="submit" className="btn-secondary btn-sm" disabled={!selectedEventId}>Add track</button>
            </div>
          </form>

          <form onSubmit={handleCreatePrize} className="event-config-form">
            <label className="form-label" htmlFor="new-prize-name">Add prize</label>
            <div className="event-config-input-row prize-input-row">
              <input
                id="new-prize-name"
                type="text"
                className="form-input"
                placeholder="Prize name..."
                value={prizeName}
                onChange={(e) => setPrizeName(e.target.value)}
                style={{ flex: 2 }}
                required
              />
              <input
                aria-label="Prize value"
                type="text"
                className="form-input"
                placeholder="Value..."
                value={prizeValue}
                onChange={(e) => setPrizeValue(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-secondary btn-sm" disabled={!selectedEventId}>Add prize</button>
            </div>
          </form>

          {selectedEvent && (
            <div className="configured-items-section">
              <h3 className="configured-items-heading">Configured for {selectedEvent.name}</h3>
              <div className="configured-items-group">
                <span className="configured-items-label">Tracks</span>
                <div className="configured-items-list">
                  {selectedEvent.tracks?.length ? selectedEvent.tracks.map((t) => (
                    <span key={t._id} className="badge-tag">{t.name}</span>
                  )) : <span className="text-muted-xs">No tracks yet</span>}
                </div>
              </div>
              <div className="configured-items-group">
                <span className="configured-items-label">Prizes</span>
                <div className="configured-items-list">
                  {selectedEvent.prizes?.length ? selectedEvent.prizes.map((p) => (
                    <span key={p._id} className="badge-tag prize-tag">{p.name}{p.value ? ` · ${p.value}` : ''}</span>
                  )) : <span className="text-muted-xs">No prizes yet</span>}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
