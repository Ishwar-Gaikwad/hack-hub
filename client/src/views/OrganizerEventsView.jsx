import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ArrowUpRight, CalendarDays, Plus, Trash2 } from 'lucide-react';

const idOf = (value) => String(value?._id || value || '');
const localDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const displayDate = (value) => value ? new Date(value).toLocaleString() : 'Not set';
const blankForm = () => ({ name: '', description: '', startDate: '', submissionDeadline: '', endDate: '' });
const draftKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function OrganizerEventsView({ onNavigate, startCreate = false }) {
  const { currentUser, sessionToken } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState(startCreate ? 'create' : 'list');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankForm);
  const [tracks, setTracks] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [trackDraft, setTrackDraft] = useState({ name: '', description: '' });
  const [prizeDraft, setPrizeDraft] = useState({ name: '', description: '', value: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/events');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load hackathons.');
      const organizerId = idOf(currentUser);
      setEvents((data.events || []).filter((event) => idOf(event.createdBy) === organizerId));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(); }, [currentUser]);
  const visibleEvents = useMemo(() => events.filter((event) => event.name.toLowerCase().includes(search.trim().toLowerCase())), [events, search]);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const beginCreate = () => { setForm(blankForm()); setTracks([]); setPrizes([]); setError(''); setScreen('create'); };

  const addTrack = () => {
    if (trackDraft.name.trim().length < 2) return;
    setTracks((current) => [...current, { ...trackDraft, name: trackDraft.name.trim(), description: trackDraft.description.trim(), key: draftKey() }]);
    setTrackDraft({ name: '', description: '' });
  };
  const addPrize = () => {
    if (prizeDraft.name.trim().length < 2) return;
    setPrizes((current) => [...current, { ...prizeDraft, name: prizeDraft.name.trim(), key: draftKey() }]);
    setPrizeDraft({ name: '', description: '', value: '' });
  };

  const createHackathon = async (e) => {
    e.preventDefault();
    setError('');
    const start = new Date(form.startDate).getTime();
    const deadline = new Date(form.submissionDeadline).getTime();
    const end = new Date(form.endDate).getTime();
    if (form.name.trim().length < 2) { setError('Hackathon name must be at least 2 characters.'); return; }
    if (tracks.some((track) => track.name.trim().length < 2) || prizes.some((prize) => prize.name.trim().length < 2)) { setError('Track and prize names must be at least 2 characters.'); return; }
    if (![start, deadline, end].every(Number.isFinite)) { setError('Enter a start date, submission deadline, and end date.'); return; }
    if (start > deadline || deadline > end) { setError('Dates must be ordered: start, submission deadline, then end.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim(), startDate: new Date(form.startDate).toISOString(), submissionDeadline: new Date(form.submissionDeadline).toISOString(), endDate: new Date(form.endDate).toISOString(), status: 'published' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create hackathon.');

      const configurationErrors = [];
      for (const track of tracks) {
        try {
          const result = await fetch(`/api/events/${data.event._id}/tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ name: track.name, description: track.description }) });
          if (!result.ok) { const issue = await result.json(); configurationErrors.push(`Track “${track.name}”: ${issue.message || 'could not be saved'}`); }
        } catch { configurationErrors.push(`Track “${track.name}”: network request failed`); }
      }
      for (const prize of prizes) {
        try {
          const result = await fetch(`/api/events/${data.event._id}/prizes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ name: prize.name, description: prize.description, value: prize.value }) });
          if (!result.ok) { const issue = await result.json(); configurationErrors.push(`Prize “${prize.name}”: ${issue.message || 'could not be saved'}`); }
        } catch { configurationErrors.push(`Prize “${prize.name}”: network request failed`); }
      }
      onNavigate('event-workspace', { eventId: data.event._id, notice: configurationErrors.length ? `Hackathon created; some setup items need attention: ${configurationErrors.join('; ')}` : 'Hackathon created successfully.' });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (currentUser?.role !== 'organizer') return <div className="empty-state-card"><h1>Organizer access required</h1></div>;

  if (screen === 'create') return <div className="page-view-container organizer-page">
    <button className="text-button" onClick={() => setScreen('list')}><ArrowLeft size={15} /> My Hackathons</button>
    <header className="page-header-block"><div className="page-title-group"><h1 className="page-title">Create Hackathon</h1><p className="page-description">Set the details, schedule, tracks, and prizes for your event.</p></div></header>
    {error && <p className="event-date-error" role="alert">{error}</p>}
    <form className="organizer-create-flow" onSubmit={createHackathon}>
      <section className="workspace-card organizer-create-section"><p className="organizer-step">STEP 1</p><h2>Basic information</h2><label className="form-group"><span className="form-label">Hackathon name</span><input className="form-input" value={form.name} onChange={(e) => setField('name', e.target.value)} minLength={2} required /></label><label className="form-group"><span className="form-label">Description</span><textarea className="form-input form-textarea" rows={4} value={form.description} onChange={(e) => setField('description', e.target.value)} /></label></section>
      <section className="workspace-card organizer-create-section"><p className="organizer-step">STEP 2</p><h2>Schedule</h2><p className="date-field-help">Local time. Start must be on or before the submission deadline, and the deadline must be on or before the end.</p>{[['startDate', 'Start date and time'], ['submissionDeadline', 'Submission deadline'], ['endDate', 'End date and time']].map(([key, label]) => <label className="form-group" key={key}><span className="form-label">{label}</span><input type="datetime-local" className="form-input event-datetime-input" value={form[key]} onChange={(e) => setField(key, e.target.value)} min={key === 'submissionDeadline' ? form.startDate || undefined : key === 'endDate' ? form.submissionDeadline || form.startDate || undefined : undefined} max={key === 'startDate' ? form.submissionDeadline || undefined : key === 'submissionDeadline' ? form.endDate || undefined : undefined} required /></label>)}</section>
      <section className="workspace-card organizer-create-section"><p className="organizer-step">STEP 3</p><h2>Tracks</h2><div className="organizer-staged-add"><input className="form-input" aria-label="Track name" placeholder="Track name" value={trackDraft.name} onChange={(e) => setTrackDraft({ ...trackDraft, name: e.target.value })} minLength={2} /><input className="form-input" aria-label="Track description" placeholder="Description (optional)" value={trackDraft.description} onChange={(e) => setTrackDraft({ ...trackDraft, description: e.target.value })} /><button className="btn-secondary btn-sm" type="button" disabled={trackDraft.name.trim().length < 2} onClick={addTrack}><Plus size={14} /> Add track</button></div>{tracks.map((track, index) => <div className="organizer-staged-row" key={track.key}><input className="form-input" aria-label={`Track ${index + 1} name`} value={track.name} onChange={(e) => setTracks((items) => items.map((item) => item.key === track.key ? { ...item, name: e.target.value } : item))} /><input className="form-input" aria-label={`Track ${index + 1} description`} value={track.description} placeholder="Description" onChange={(e) => setTracks((items) => items.map((item) => item.key === track.key ? { ...item, description: e.target.value } : item))} /><button className="btn-icon" type="button" aria-label={`Remove ${track.name}`} onClick={() => setTracks((items) => items.filter((item) => item.key !== track.key))}><Trash2 size={15} /></button></div>)}</section>
      <section className="workspace-card organizer-create-section"><p className="organizer-step">STEP 4</p><h2>Prizes</h2><div className="organizer-staged-add organizer-prize-add"><input className="form-input" aria-label="Prize name" placeholder="Prize name" value={prizeDraft.name} onChange={(e) => setPrizeDraft({ ...prizeDraft, name: e.target.value })} minLength={2} /><input className="form-input" aria-label="Prize value" placeholder="Value (optional)" value={prizeDraft.value} onChange={(e) => setPrizeDraft({ ...prizeDraft, value: e.target.value })} /><input className="form-input" aria-label="Prize description" placeholder="Description (optional)" value={prizeDraft.description} onChange={(e) => setPrizeDraft({ ...prizeDraft, description: e.target.value })} /><button className="btn-secondary btn-sm" type="button" disabled={prizeDraft.name.trim().length < 2} onClick={addPrize}><Plus size={14} /> Add prize</button></div>{prizes.map((prize, index) => <div className="organizer-staged-row organizer-prize-row" key={prize.key}><input className="form-input" aria-label={`Prize ${index + 1} name`} value={prize.name} onChange={(e) => setPrizes((items) => items.map((item) => item.key === prize.key ? { ...item, name: e.target.value } : item))} /><input className="form-input" aria-label={`Prize ${index + 1} value`} value={prize.value} placeholder="Value" onChange={(e) => setPrizes((items) => items.map((item) => item.key === prize.key ? { ...item, value: e.target.value } : item))} /><input className="form-input" aria-label={`Prize ${index + 1} description`} value={prize.description} placeholder="Description" onChange={(e) => setPrizes((items) => items.map((item) => item.key === prize.key ? { ...item, description: e.target.value } : item))} /><button className="btn-icon" type="button" aria-label={`Remove ${prize.name}`} onClick={() => setPrizes((items) => items.filter((item) => item.key !== prize.key))}><Trash2 size={15} /></button></div>)}</section>
      <section className="workspace-card organizer-review-section"><p className="organizer-step">FINAL STEP</p><h2>Review</h2><dl><dt>Hackathon</dt><dd>{form.name || 'Name not entered'}</dd><dt>Schedule</dt><dd>{displayDate(form.startDate)} → {displayDate(form.submissionDeadline)} → {displayDate(form.endDate)}</dd><dt>Tracks</dt><dd>{tracks.length ? tracks.map((track) => track.name).join(', ') : 'None added'}</dd><dt>Prizes</dt><dd>{prizes.length ? prizes.map((prize) => prize.name).join(', ') : 'None added'}</dd></dl><button className="btn-primary" disabled={busy}><Plus size={15} /> {busy ? 'Creating…' : 'Create Hackathon'}</button></section>
    </form>
  </div>;

  return <div className="page-view-container organizer-page">
    <header className="page-header-block"><div className="page-title-group"><p className="organizer-eyebrow">Organizer</p><h1 className="page-title">My Hackathons</h1><p className="page-description">All hackathons hosted by your account.</p></div><button className="btn-primary" onClick={beginCreate}><Plus size={16} /> Create Hackathon</button></header>
    {error && <p className="event-date-error" role="alert">{error}</p>}
    <div className="organizer-list-toolbar"><label className="organizer-search-label"><span className="sr-only">Search hackathons</span><input className="form-input" placeholder="Search hackathons" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span>{visibleEvents.length} {visibleEvents.length === 1 ? 'hackathon' : 'hackathons'}</span></div>
    {loading ? <div className="empty-loading-state">Loading hackathons…</div> : visibleEvents.length ? <div className="organizer-event-list">{visibleEvents.map((event) => <article className="organizer-event-row" key={event._id}><span><strong>{event.name}</strong><small><CalendarDays size={13} /> Starts {displayDate(event.startDate)} · Deadline {displayDate(event.submissionDeadline)} · Ends {displayDate(event.endDate)}</small></span><div className="organizer-row-actions"><span className={`organizer-status status-${event.status}`}>{event.status}</span><button className="btn-secondary btn-sm" onClick={() => onNavigate('event-workspace', { eventId: event._id })}>Manage <ArrowUpRight size={14} /></button></div></article>)}</div> : <section className="organizer-first-event"><h2>{search ? 'No matching hackathons' : 'No hackathons yet'}</h2><p>{search ? 'Try another search.' : 'Create your first hackathon to get started.'}</p></section>}
  </div>;
}
