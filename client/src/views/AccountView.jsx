import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut } from 'lucide-react';

export default function AccountView() {
  const { currentUser, logout, sessionToken } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="page-view-container">
      <div className="page-header-block">
        <div className="page-title-group">
          <h1 className="page-title">Account Settings</h1>
          <p className="page-description">
            Your HackHub profile and account access.
          </p>
        </div>
      </div>

      <div className="account-card">
        <div className="account-row">
          <div className="account-icon-wrapper">
            <User size={24} color="#a855f7" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="account-email">{currentUser.email}</div>
            <div className="account-role-badge">
              Role: <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{currentUser.role}</span>
            </div>
          </div>
        </div>

        <div className="account-actions">
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
