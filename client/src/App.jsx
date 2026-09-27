import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';

// Views
import HomeView from './views/HomeView';
import EventsView from './views/EventsView';
import ProjectsView from './views/ProjectsView';
import ParticipantDashboard from './views/ParticipantDashboard';
import ParticipantTeamView from './views/ParticipantTeamView';
import ParticipantProjectView from './views/ParticipantProjectView';
import AccountView from './views/AccountView';
import OrganizerEventsView from './views/OrganizerEventsView';
import OrganizerSubmissionsView from './views/OrganizerSubmissionsView';
import AdminView from './views/AdminView';
import DeveloperDiagnosticsView from './views/DeveloperDiagnosticsView';
import PlaceholderView from './views/PlaceholderView';

const ROLE_VIEWS = {
  participant: ['dashboard', 'my-team', 'my-project', 'account'],
  judge: ['assigned-projects', 'reviews', 'account'],
  organizer: ['my-events', 'submissions', 'judges', 'judging', 'results', 'account'],
  admin: ['admin-system', 'developer', 'account']
};

function AppContent() {
  const { currentUser, loading } = useAuth();

  const getDefaultViewForRole = (role) => {
    switch (role) {
      case 'participant':
        return 'dashboard';
      case 'judge':
        return 'assigned-projects';
      case 'organizer':
        return 'my-events';
      case 'admin':
        return 'admin-system';
      default:
        return 'home';
    }
  };

  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (hash) {
      if (hash === 'events') return 'hackathons';
      if (hash === 'admin/developer' || hash === 'diagnostics') return 'developer';
      return hash;
    }
    return currentUser ? getDefaultViewForRole(currentUser.role) : 'home';
  };

  const [activeView, setActiveView] = useState(getInitialView);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState('login');
  const [authModalInitialRole, setAuthModalInitialRole] = useState('participant');
  const [participantContext, setParticipantContext] = useState({});
  const previousUser = useRef(null);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash) {
        if (hash === 'events') setActiveView('hackathons');
        else if (hash === 'admin/developer' || hash === 'diagnostics') setActiveView('developer');
        else setActiveView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Keep direct hash navigation inside the current role's experience.
  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        const publicViews = ['home', 'hackathons', 'projects'];
        const allowedViews = [...publicViews, ...(ROLE_VIEWS[currentUser.role] || [])];

        if (!allowedViews.includes(activeView)) {
          const defaultView = getDefaultViewForRole(currentUser.role);
          setActiveView(defaultView);
          window.location.hash = defaultView;
        } else if (!previousUser.current && activeView === 'home') {
          const defaultView = getDefaultViewForRole(currentUser.role);
          setActiveView(defaultView);
          window.location.hash = defaultView;
        }
      } else {
        const publicViews = ['home', 'hackathons', 'projects', 'developer'];
        if (!publicViews.includes(activeView)) {
          setActiveView('home');
          window.location.hash = '';
        }
      }
      previousUser.current = currentUser;
    }
  }, [currentUser, loading, activeView]);

  const navigateTo = (view, context = {}) => {
    setParticipantContext(context);
    setActiveView(view);
    window.location.hash = view === 'home' ? '' : view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuth = (mode = 'login', role = 'participant') => {
    setAuthModalInitialMode(mode);
    setAuthModalInitialRole(role);
    setAuthModalOpen(true);
  };

  const publicViews = ['home', 'hackathons', 'projects'];
  const allowedViews = [...publicViews, ...(ROLE_VIEWS[currentUser?.role] || [])];
  const visibleView = currentUser && !allowedViews.includes(activeView)
    ? getDefaultViewForRole(currentUser.role)
    : activeView;

  if (loading) {
    return <div className="empty-loading-state" style={{ marginTop: '20vh' }}>Loading HackHub...</div>;
  }

  return (
    <div className="app-layout">
      {/* Top Role-Specific Navbar */}
      <Navbar
        activeView={visibleView}
        setActiveView={navigateTo}
        onOpenAuth={openAuth}
      />

      {/* Main Content Area */}
      <main className="main-content-container">
        {/* Public Views */}
        {visibleView === 'home' && (
          <HomeView onNavigate={navigateTo} onOpenAuth={openAuth} />
        )}
        {visibleView === 'hackathons' && (
          <EventsView onNavigate={navigateTo} onOpenAuth={openAuth} />
        )}
        {visibleView === 'projects' && (
          <ProjectsView />
        )}

        {/* Participant Views */}
        {visibleView === 'dashboard' && (
          <ParticipantDashboard onNavigate={navigateTo} />
        )}
        {visibleView === 'my-team' && (
          <ParticipantTeamView
            initialEventId={participantContext.eventId}
            onNavigate={navigateTo}
          />
        )}
        {visibleView === 'my-project' && (
          <ParticipantProjectView
            initialEventId={participantContext.eventId}
            initialTeamId={participantContext.teamId}
            onNavigate={navigateTo}
          />
        )}

        {/* Judge Views */}
        {visibleView === 'assigned-projects' && (
          <PlaceholderView
            title="Assigned Projects"
            description="Projects assigned to your judge queue for review."
          />
        )}
        {visibleView === 'reviews' && (
          <PlaceholderView
            title="Reviews & Scoring"
            description="Structured rubric criteria and scorecards."
          />
        )}

        {/* Organizer Views */}
        {visibleView === 'my-events' && (
          <OrganizerEventsView />
        )}
        {visibleView === 'submissions' && (
          <OrganizerSubmissionsView />
        )}
        {visibleView === 'judges' && (
          <PlaceholderView
            title="Judges Management"
            description="Invite judges and assign evaluation quotas."
          />
        )}
        {visibleView === 'judging' && (
          <PlaceholderView
            title="Judging Progress"
            description="Track review status and score completion across tracks."
          />
        )}
        {visibleView === 'results' && (
          <PlaceholderView
            title="Results & Winners"
            description="Calculated score averages and winner selection."
          />
        )}

        {/* Admin & Developer Views */}
        {visibleView === 'admin-system' && (
          <AdminView onNavigate={navigateTo} />
        )}
        {visibleView === 'developer' && (
          <DeveloperDiagnosticsView />
        )}

        {/* Common Account View */}
        {visibleView === 'account' && (
          <AccountView />
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="minimal-footer">
        <div className="footer-content">
          <span>&copy; 2026 HackHub Platform</span>
          <div className="footer-links">
            <button className="footer-link-btn" onClick={() => navigateTo('hackathons')}>Hackathons</button>
            <button className="footer-link-btn" onClick={() => navigateTo('projects')}>Projects</button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalInitialMode}
        initialRole={authModalInitialRole}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
