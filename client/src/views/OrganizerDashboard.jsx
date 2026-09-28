import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, Plus, ArrowUpRight } from 'lucide-react';

const eventOwnerId = (event) => String(event.createdBy?._id || event.createdBy || '');
const userId = (user) => String(user?._id || user?.id || '');
const eventDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date pending';

export default function OrganizerDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/events');
      const data = response.ok ? await response.json() : null;
      if (!response.ok) throw new Error(data?.message || 'Could not load your hackathons.');
      const ownerId = userId(currentUser);
      const hostedEvents = (data.events || []).filter((event) => eventOwnerId(event) === ownerId);
      const enrichedEvents = await Promise.all(hostedEvents.map(async (event) => {
        try {
          const [detailsResponse, projectsResponse] = await Promise.all([
            fetch(`/api/events/${event._id}`),
            fetch(`/api/events/${event._id}/projects`)
          ]);
          const [details, submitted] = await Promise.all([
            detailsResponse.ok ? detailsResponse.json() : Promise.resolve({}),
            projectsResponse.ok ? projectsResponse.json() : Promise.resolve({ projects: [] })
          ]);
          return { ...event, trackCount: details.event?.tracks?.length ?? null, prizeCount: details.event?.prizes?.length ?? null, submissionCount: submitted.projects?.length ?? null };
        } catch {
          return { ...event, trackCount: null, prizeCount: null, submissionCount: null };
        }
      }));
      setEvents(enrichedEvents);
    } catch (err) {
      setError(err.message || 'Could not load your hackathons.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  const needsAttention = events.filter((event) => {
    const deadline = new Date(event.submissionDeadline).getTime();
    const deadlineSoon = Number.isFinite(deadline) && deadline > Date.now() && deadline - Date.now() < 7 * 86400000;
    return event.trackCount === 0 || event.prizeCount === 0 || deadlineSoon;
  });

  return (
    <div className="page-view-container organizer-landing">
      <header className="organizer-landing-header">
        <div><p className="organizer-eyebrow">Organizer</p><h1 className="page-title">Your Hackathons</h1><p className="page-description">Welcome{currentUser?.email ? `, ${currentUser.email}` : ''}. Manage the events you host.</p></div>
        <div className="organizer-header-actions"><button className="btn-primary" onClick={() => onNavigate('my-events', { create: true })}><Plus size={16} /> Create Hackathon</button></div>
      </header>

      {error && <div className="event-date-error" role="alert">{error} <button className="text-button" onClick={loadEvents}>Try again</button></div>}
      {loading ? <div className="empty-loading-state">Loading your hackathons…</div> : events.length ? (
        <section className="hosted-events" aria-label="Hackathons you host">
          {events.map((event) => <article className="hosted-event-card" key={event._id}>
            <div className="hosted-event-card-top"><span className={`organizer-status status-${event.status}`}>{event.status}</span><span className="hosted-event-date"><CalendarDays size={14} /> Starts {eventDate(event.startDate)}</span></div>
            <h2>{event.name}</h2>
            {event.description && <p>{event.description}</p>}
            <dl className="hosted-event-meta"><dt>Submission deadline</dt><dd>{eventDate(event.submissionDeadline)}</dd><dt>Ends</dt><dd>{eventDate(event.endDate)}</dd><dt>Tracks</dt><dd>{event.trackCount ?? 'Unavailable'}</dd><dt>Submissions</dt><dd>{event.submissionCount ?? 'Unavailable'}</dd></dl>
            <div className="hosted-event-footer"><button className="text-button" onClick={() => onNavigate('event-workspace', { eventId: event._id })}>Manage <ArrowUpRight size={14} /></button></div>
          </article>)}
        </section>
      ) : <section className="organizer-first-event"><h2>No hackathons yet</h2><p>Create your first hackathon to get started.</p></section>}
      {!loading && needsAttention.length > 0 && <section className="organizer-attention"><h2>Needs attention</h2>{needsAttention.map((event) => { const setupIncomplete = event.trackCount === 0 || event.prizeCount === 0; return <button key={event._id} onClick={() => onNavigate('event-workspace', { eventId: event._id, tab: setupIncomplete ? 'settings' : 'submissions' })}><span><strong>{event.name}</strong><small>{setupIncomplete ? 'Event setup is incomplete' : 'Submission deadline is approaching'}</small></span><ArrowUpRight size={15} /></button>; })}</section>}
    </div>
  );
}
