'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useAuth } from '@/lib/AuthContext';
import { confirmAction, toastSuccess } from '@/lib/alerts';
import Sidebar from './Sidebar';
import AuthImage from './AuthImage';
import SystemUpdateGate from './SystemUpdateGate';

// Shared authenticated-page wrapper: sidebar + topbar + content area. Every
// page under the dashboard (profile, users, teams, leave, roles,
// registrations, the home page) renders <AppShell title="..."> around its
// own content instead of duplicating this chrome. Also gates the page
// behind useRequireAuth, same as the old standalone home page did.
export default function AppShell({ title, actions, children }) {
  const { user, loading } = useRequireAuth();
  const { logout, roles } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading || !user) return null;

  const handleLogout = async () => {
    const confirmed = await confirmAction('Log out?', 'Are you sure you want to log out?', {
      confirmButtonText: 'Log out',
      cancelButtonText: 'No',
    });
    if (!confirmed) return;

    await logout();
    toastSuccess('Logged out');
    router.replace('/login');
  };

  const primaryRole = roles?.[0]?.roleName || 'Staff';
  const initials = (user.fullName || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      <SystemUpdateGate />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label="Toggle menu"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="topbar-title">{title}</div>
          </div>

          <div className="topbar-user">
            {actions}
            <div className="topbar-user-avatar">
              <AuthImage src={user.profilePhotoUrl} alt={user.fullName} fallback={initials} />
            </div>
            <div className="topbar-user-info">
              <div className="name">{user.fullName}</div>
              <div className="role">{primaryRole}</div>
            </div>
            <button type="button" className="topbar-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
