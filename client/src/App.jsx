import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import RibbonFieldBackground from './components/RibbonFieldBackground';

// Views
import HomeView from './views/HomeView';
import EventsView from './views/EventsView';
import ProjectsView from './views/ProjectsView';
import ParticipantDashboard from './views/ParticipantDashboard';
import OrganizerDashboard from './views/OrganizerDashboard';
import ParticipantTeamView from './views/ParticipantTeamView';
import ParticipantProjectView from './views/ParticipantProjectView';
import AccountView from './views/AccountView';
import OrganizerEventsView from './views/OrganizerEventsView';
import OrganizerWorkspace from './views/OrganizerWorkspace';
import AdminView from './views/AdminView';
import DeveloperDiagnosticsView from './views/DeveloperDiagnosticsView';
import JudgeDashboard from './views/JudgeDashboard';
import PlaceholderView from './views/PlaceholderView';

const ROLE_VIEWS = {
  participant: ['dashboard', 'my-team', 'my-project', 'account'],
  judge: ['assigned-projects', 'reviews', 'account'],
  organizer: ['dashboard', 'my-events', 'event-workspace', 'submissions', 'judges', 'judging', 'results', 'account'],
  admin: ['admin-system', 'developer', 'account']
};

function routeFromHash() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  const workspaceRoute = hash.match(/^event-workspace\/([^/]+)(?:\/([^/]+))?$/);
  if (workspaceRoute) return { view: 'event-workspace', eventId: workspaceRoute[1], tab: workspaceRoute[2] || 'overview' };
  if (hash === 'events') return { view: 'hackathons' };
  if (hash === 'admin/developer' || hash === 'diagnostics') return { view: 'developer' };
  return { view: hash || 'home' };
}

function AppContent() {
  const { currentUser, loading } = useAuth();

  const getDefaultViewForRole = (role) => {
    switch (role) {
      case 'participant':
        return 'dashboard';
      case 'judge':
        return 'assigned-projects';
      case 'organizer':
        return 'dashboard';
      case 'admin':
        return 'admin-system';
      default:
        return 'home';
    }
  };

  const getInitialView = () => {
    const route = routeFromHash();
    if (route.view !== 'home') return route.view;
    return currentUser ? getDefaultViewForRole(currentUser.role) : 'home';
  };

  const [activeView, setActiveView] = useState(getInitialView);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState('login');
  const [authModalInitialRole, setAuthModalInitialRole] = useState('participant');
  const [participantContext, setParticipantContext] = useState(() => {
    const route = routeFromHash();
    return route.view === 'event-workspace' ? { eventId: route.eventId, tab: route.tab } : {};
  });
  const previousUser = useRef(null);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const route = routeFromHash();
      if (route.view) setActiveView(route.view);
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
    window.location.hash = view === 'home'
      ? ''
      : view === 'event-workspace' && context.eventId
        ? `event-workspace/${context.eventId}/${context.tab || 'overview'}`
        : view;
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
    <div className={`app-layout ${visibleView === 'home' && !currentUser ? 'public-home-layout' : ''}`}>
      <RibbonFieldBackground />
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
        {visibleView === 'dashboard' && currentUser?.role === 'participant' && (
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
        {['assigned-projects', 'reviews'].includes(visibleView) && (
          <JudgeDashboard onOpenAuth={openAuthModal} />
        )}

        {/* Organizer Views */}
        {visibleView === 'dashboard' && currentUser?.role === 'organizer' && (
          <OrganizerDashboard onNavigate={navigateTo} />
        )}
        {visibleView === 'my-events' && currentUser?.role === 'organizer' && (
          <OrganizerEventsView onNavigate={navigateTo} startCreate={Boolean(participantContext.create)} />
        )}
        {['event-workspace', 'submissions', 'judges', 'judging', 'results'].includes(visibleView) && currentUser?.role === 'organizer' && (
          <OrganizerWorkspace
            eventId={routeFromHash().eventId || participantContext.eventId}
            initialTab={routeFromHash().tab || (['submissions', 'judges', 'judging', 'results'].includes(visibleView) ? visibleView : participantContext.tab || 'overview')}
            initialNotice={participantContext.notice}
            onNavigate={navigateTo}
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
          {currentUser?.role !== 'organizer' && <div className="footer-links">
            <button className="footer-link-btn" onClick={() => navigateTo('hackathons')}>Hackathons</button>
            <button className="footer-link-btn" onClick={() => navigateTo('projects')}>Projects</button>
          </div>}
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
