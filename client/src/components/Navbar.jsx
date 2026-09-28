import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, LogIn, Menu, X } from 'lucide-react';

export default function Navbar({ activeView, setActiveView, onOpenAuth }) {
  const { currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getNavLinks = () => {
    if (!currentUser) {
      return [
        { id: 'home', label: 'Home' },
        { id: 'hackathons', label: 'Hackathons' },
        { id: 'projects', label: 'Projects' }
      ];
    }

    switch (currentUser.role) {
      case 'participant':
        return [
          { id: 'home', label: 'Home' },
          { id: 'hackathons', label: 'Hackathons' },
          { id: 'projects', label: 'Projects' },
          { id: 'dashboard', label: 'My Hackathons' },
          { id: 'account', label: 'Account' }
        ];
      case 'judge':
        return [
          { id: 'assigned-projects', label: 'Assigned Projects' },
          { id: 'reviews', label: 'Reviews' },
          { id: 'account', label: 'Account' }
        ];
      case 'organizer':
        return [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'my-events', label: 'My Hackathons' },
          { id: 'account', label: 'Account' }
        ];
      case 'admin':
        return [
          { id: 'admin-system', label: 'Admin/System' },
          { id: 'developer', label: 'Developer' },
          { id: 'account', label: 'Account' }
        ];
      default:
        return [
          { id: 'home', label: 'Home' },
          { id: 'hackathons', label: 'Hackathons' },
          { id: 'projects', label: 'Projects' }
        ];
    }
  };

  const navLinks = getNavLinks();

  const handleNavClick = (viewId) => {
    setActiveView(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar-container">
      {/* Brand */}
      <div
        className="nav-brand"
        onClick={() => handleNavClick(currentUser ? navLinks[0].id : 'home')}
        style={{ cursor: 'pointer' }}
      >
        <div className="brand-icon-wrapper">
          <Layers size={20} color="#ffffff" />
        </div>
        <span className="brand-title">HackHub</span>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="nav-links">
        {navLinks.map((link) => (
          <button
            key={link.id}
            className={`nav-link ${activeView === link.id ? 'active' : ''}`}
            onClick={() => handleNavClick(link.id)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      {/* Desktop Right Actions */}
      <div className="nav-actions">
        {!currentUser && (
          <button
            className="btn-primary btn-sm"
            onClick={() => onOpenAuth('login')}
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
        )}

        {/* Mobile menu toggle */}
        <button
          className="btn-icon mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`mobile-nav-link ${activeView === link.id ? 'active' : ''}`}
              onClick={() => handleNavClick(link.id)}
            >
              {link.label}
            </button>
          ))}
          {!currentUser && (
            <button
              className="btn-primary"
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('login');
              }}
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
}
