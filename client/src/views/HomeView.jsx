import React, { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Clock, FolderGit2, Users, CalendarPlus, ClipboardCheck } from 'lucide-react';
import ConstellationCanvas from '../components/ConstellationCanvas';
import EventDetailModal from '../components/EventDetailModal';
import ProjectDetailModal from '../components/ProjectDetailModal';

export default function HomeView({ onNavigate, onOpenAuth }) {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (response.ok) {
          const data = await response.json();
          if (active) setEvents(data.events || []);
        }
      } catch {
        // Keep the public landing page useful when event data is unavailable.
      } finally {
        if (active) setEventsLoading(false);
      }
    };

    fetchEvents();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          if (active) setProjects((data.projects || []).slice(0, 3));
        }
      } catch {
        // Keep the public landing page useful when gallery data is unavailable.
      } finally {
        if (active) setProjectsLoading(false);
      }
    };

    fetchProjects();
    return () => { active = false; };
  }, []);

  const formatDate = (dateValue) => {
    if (!dateValue) return 'Date to be announced';
    return new Date(dateValue).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const now = new Date();
  const visibleEvents = events
    .filter((event) => {
      const endDate = event.endDate || event.submissionDeadline;
      return !endDate || new Date(endDate) >= now;
    })
    .slice(0, 3);

  return (
    <div className="home-minimal-view">
      <ConstellationCanvas />

      <section className="home-intro-section" aria-labelledby="home-hero-heading">
        <div className="home-hero-content">
          <span className="home-eyebrow">Open source · Self-hosted</span>
          <h1 className="home-headline" id="home-hero-heading">
            BUILD. <span className="home-headline-accent">JUDGE.</span> SHIP.
          </h1>
          <p className="home-subheadline">
            A self-hostable platform for hackathons — from kickoff to results.
          </p>
          <div className="home-cta-row">
            <button className="btn-primary btn-lg" onClick={() => onNavigate('hackathons')}>
              Browse Hackathons <ArrowRight size={17} />
            </button>
            <button className="btn-outline btn-lg" onClick={() => onNavigate('projects')}>
              View Projects
            </button>
          </div>
        </div>
      </section>

      <section className="home-events-section" aria-labelledby="home-events-heading">
        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">Find your next challenge</span>
            <h2 id="home-events-heading">Active & Upcoming Hackathons</h2>
          </div>
          <button className="home-text-link" onClick={() => onNavigate('hackathons')}>
            All hackathons <ArrowRight size={15} />
          </button>
        </div>

        {eventsLoading ? (
          <div className="home-discovery-empty">Loading hackathons...</div>
        ) : visibleEvents.length === 0 ? (
          <div className="home-discovery-empty">No active hackathons scheduled at this time.</div>
        ) : (
          <div className="home-event-grid">
            {visibleEvents.map((event) => {
              const isUpcoming = event.startDate && new Date(event.startDate) > now;
              const eventTracks = Array.isArray(event.tracks) ? event.tracks.slice(0, 2) : [];

              return (
                <article className="home-event-card" key={event._id}>
                  <div className="home-event-card-heading">
                    <span className="home-event-state">{isUpcoming ? 'Upcoming' : 'Active'}</span>
                    <h3>{event.name}</h3>
                    <p>{event.description || 'Explore this HackHub event and its tracks.'}</p>
                  </div>
                  <div className="home-event-details">
                    <span><CalendarDays size={15} /> {formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
                    <span><Clock size={15} /> Deadline {formatDate(event.submissionDeadline)}</span>
                  </div>
                  {eventTracks.length > 0 && (
                    <div className="home-event-tracks" aria-label="Event tracks">
                      {eventTracks.map((track) => (
                        <span key={track._id || track.name}>{track.name}</span>
                      ))}
                    </div>
                  )}
                  <button className="btn-secondary home-event-action" onClick={() => setSelectedEventId(event._id)}>
                    View Hackathon <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="home-roles-section" aria-labelledby="home-roles-heading">
        <div className="home-section-intro">
          <span className="home-section-kicker">Made for the whole community</span>
          <h2 id="home-roles-heading">One platform. Every role.</h2>
        </div>
        <div className="home-role-grid">
          <article className="home-role-card home-role-participant">
            <span className="home-role-icon"><Users size={20} /></span>
            <h3>Participant</h3>
            <p>Discover hackathons, build with your team, and submit.</p>
            <button className="btn-secondary" onClick={() => onOpenAuth('register', 'participant')}>
              Enter as Participant <ArrowRight size={15} />
            </button>
          </article>
          <article className="home-role-card home-role-organizer">
            <span className="home-role-icon"><CalendarPlus size={20} /></span>
            <h3>Organizer</h3>
            <p>Create events, manage submissions, and run judging.</p>
            <button className="btn-secondary" onClick={() => onOpenAuth('register', 'organizer')}>
              Enter as Organizer <ArrowRight size={15} />
            </button>
          </article>
          <article className="home-role-card home-role-judge">
            <span className="home-role-icon"><ClipboardCheck size={20} /></span>
            <h3>Judge</h3>
            <p>Review assigned projects and submit evaluations.</p>
            <button className="btn-secondary" onClick={() => onOpenAuth('register', 'judge')}>
              Enter as Judge <ArrowRight size={15} />
            </button>
          </article>
        </div>
      </section>

      <section className="home-projects-section" aria-labelledby="home-projects-heading">
        <div className="home-section-heading">
          <div>
            <span className="home-section-kicker">Made by the community</span>
            <h2 id="home-projects-heading">Public Projects</h2>
          </div>
          <button className="home-text-link" onClick={() => onNavigate('projects')}>
            View gallery <ArrowRight size={15} />
          </button>
        </div>
        {projectsLoading ? (
          <div className="home-discovery-empty">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="home-discovery-empty">Community projects will appear here.</div>
        ) : (
          <div className="home-project-grid">
            {projects.map((project) => (
              <article className="home-project-card" key={project._id}>
                <span className="home-project-icon"><FolderGit2 size={18} /></span>
                <h3>{project.title}</h3>
                <p>{project.description || 'A project from the HackHub community gallery.'}</p>
                <button className="home-project-link" onClick={() => setSelectedProject(project)}>
                  View project <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="home-final-cta" aria-labelledby="home-final-heading">
        <div>
          <span className="home-section-kicker">Your next idea starts here</span>
          <h2 id="home-final-heading">Ready to build?</h2>
        </div>
        <div className="home-cta-row">
          <button className="btn-primary" onClick={() => onNavigate('hackathons')}>
            Browse Hackathons <ArrowRight size={16} />
          </button>
          <button className="btn-outline" onClick={() => onNavigate('projects')}>
            View Projects
          </button>
        </div>
      </section>

      <EventDetailModal
        eventId={selectedEventId}
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        onNavigateToWorkspace={(eventId, teamId) => onNavigate('my-team', { eventId, teamId })}
        onOpenAuth={onOpenAuth}
      />
      <ProjectDetailModal
        project={selectedProject}
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
