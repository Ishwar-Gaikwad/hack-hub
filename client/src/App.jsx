import React, { useState, useEffect } from 'react';
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

  // When auth state changes, route away from public home if logged in
  useEffect(() => {
    if (!loading) {
      if (currentUser) {
        if (activeView === 'home') {
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
    }
  }, [currentUser, loading]);

  const navigateTo = (view) => {
    setActiveView(view);
    window.location.hash = view === 'home' ? '' : view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuth = (mode = 'login', role = 'participant') => {
    setAuthModalInitialMode(mode);
    setAuthModalInitialRole(role);
    setAuthModalOpen(true);
  };

  if (loading) {
    return <div className="empty-loading-state" style={{ marginTop: '20vh' }}>Loading HackHub...</div>;
  }

  return (
    <div className="app-layout">
      {/* Top Role-Specific Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={navigateTo}
        onOpenAuth={openAuth}
      />

      {/* Main Content Area */}
      <main className="main-content-container">
        {/* Public Views */}
        {activeView === 'home' && (
          <HomeView onNavigate={navigateTo} onOpenAuth={openAuth} />
        )}
        {activeView === 'hackathons' && (
          <EventsView onNavigate={navigateTo} onOpenAuth={openAuth} />
        )}
        {activeView === 'projects' && (
          <ProjectsView />
        )}

        {/* Participant Views */}
        {activeView === 'dashboard' && (
          <ParticipantDashboard onNavigate={navigateTo} />
        )}
        {activeView === 'my-team' && (
          <ParticipantTeamView />
        )}
        {activeView === 'my-project' && (
          <ParticipantProjectView />
        )}

        {/* Judge Views */}
        {activeView === 'assigned-projects' && (
          <PlaceholderView
            title="Assigned Projects"
            description="Projects assigned to your judge queue for review."
          />
        )}
        {activeView === 'reviews' && (
          <PlaceholderView
            title="Reviews & Scoring"
            description="Structured rubric criteria and scorecards."
          />
        )}

        {/* Organizer Views */}
        {activeView === 'my-events' && (
          <OrganizerEventsView />
        )}
        {activeView === 'submissions' && (
          <OrganizerSubmissionsView />
        )}
        {activeView === 'judges' && (
          <PlaceholderView
            title="Judges Management"
            description="Invite judges and assign evaluation quotas."
          />
        )}
        {activeView === 'judging' && (
          <PlaceholderView
            title="Judging Progress"
            description="Track review status and score completion across tracks."
          />
        )}
        {activeView === 'results' && (
          <PlaceholderView
            title="Results & Winners"
            description="Calculated score averages and winner selection."
          />
        )}

        {/* Admin & Developer Views */}
        {activeView === 'admin-system' && (
          <AdminView onNavigate={navigateTo} />
        )}
        {activeView === 'developer' && (
          <DeveloperDiagnosticsView />
        )}

        {/* Common Account View */}
        {activeView === 'account' && (
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
