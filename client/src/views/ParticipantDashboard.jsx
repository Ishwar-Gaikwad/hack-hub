import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, CalendarDays, Clock, FolderGit2, Users } from 'lucide-react';

const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => (
  value ? new Date(value).toLocaleDateString(undefined, options) : 'To be announced'
);

export default function ParticipantDashboard({ onNavigate }) {
  const { sessionToken } = useAuth();
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchParticipation = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${sessionToken}` };
        const [teamsResponse, projectsResponse] = await Promise.all([
          fetch('/api/teams/my-teams', { headers }),
          fetch('/api/projects/my-projects', { headers })
        ]);
        const [teamsData, projectsData] = await Promise.all([
          teamsResponse.ok ? teamsResponse.json() : { teams: [] },
          projectsResponse.ok ? projectsResponse.json() : { projects: [] }
        ]);
        if (active) {
          setTeams(teamsData.teams || []);
          setProjects(projectsData.projects || []);
        }
      } catch {
        if (active) {
          setTeams([]);
          setProjects([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (sessionToken) fetchParticipation();
    return () => { active = false; };
  }, [sessionToken]);

  const eventEntries = [];
  teams.forEach((team) => {
    const event = team.eventId && typeof team.eventId === 'object' ? team.eventId : null;
    if (!event?._id || eventEntries.some((entry) => entry.event._id === event._id)) return;
    const project = projects.find((item) => String(item.teamId?._id || item.teamId) === String(team._id));
    eventEntries.push({ event, team, project });
  });

  if (loading) return <div className="empty-loading-state">Loading your hackathons...</div>;

  return (
    <div className="page-view-container participant-page">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">My Hackathons</h1>
          <p className="page-description">Your events, team, project, and next step.</p>
        </div>
      </div>

      {eventEntries.length === 0 ? (
        <section className="participant-welcome" aria-labelledby="participant-welcome-title">
          <span className="participant-kicker">Your next build starts here</span>
          <h2 id="participant-welcome-title">Welcome to HackHub.</h2>
          <p>Find a hackathon and start building.</p>
          <button className="btn-primary btn-lg" onClick={() => onNavigate('hackathons')}>
            Browse Hackathons <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <section className="participant-hackathon-list" aria-label="Your hackathons">
          {eventEntries.map(({ event, team, project }) => (
            <article className="participant-hackathon-card" key={event._id}>
              <div className="participant-hackathon-heading">
                <div>
                  <span className="participant-kicker">Your hackathon</span>
                  <h2>{event.name}</h2>
                </div>
                {project && (
                  <span className={`badge-tag ${project.status === 'submitted' ? 'badge-submitted' : 'badge-draft'}`}>
                    {project.status === 'submitted' ? 'Submitted' : 'Draft'}
                  </span>
                )}
              </div>
              <div className="participant-hackathon-facts">
                <span><CalendarDays size={15} /> {formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
                <span><Users size={15} /> {team.name}</span>
                {project && <span><FolderGit2 size={15} /> {project.title}</span>}
                <span><Clock size={15} /> Deadline {formatDate(event.submissionDeadline, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <button
                className="btn-primary participant-card-action"
                onClick={() => onNavigate(project ? 'my-project' : 'my-team', { eventId: event._id, teamId: team._id })}
              >
                {project ? 'Open My Project' : 'Open Hackathon'} <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
