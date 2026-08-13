'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useSystemUpdateStatus } from '@/lib/useSystemUpdate';

// Minimal hand-rolled icon set (no icon library in this project) — each is a
// 18x18 stroke icon so they line up with the sidebar's font-size/line-height.
const Icon = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c1.2-3.6 3.8-5 6.5-5s5.3 1.4 6.5 5" />
      <circle cx="17" cy="8" r="2.6" /><path d="M15.5 8.2c.6-.5 1.3-.7 2-.7 2 0 3.8 1.2 4.5 4" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
    </svg>
  ),
  leave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" />
      <path d="M8 14l2.2 2.2L16 11" />
    </svg>
  ),
  roles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.5l7 3.2v5.3c0 4.7-3 8.7-7 10.5-4-1.8-7-5.8-7-10.5V5.7l7-3.2z" />
      <path d="M9 12l2 2 4-4.2" />
    </svg>
  ),
  registrations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" /><path d="M14 3v6h6" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  ),
  systemUpdates: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.5 3.5L4 7v6c0 4.2 2.8 7 8 9.5 5.2-2.5 8-5.3 8-9.5V7l-6.5-3.5z" />
      <path d="M12 8v4.5M12 15.2v.1" strokeLinecap="round" />
    </svg>
  ),
  holidays: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" />
      <path d="M7.5 13.5h3M13.5 13.5h3M7.5 17h3M13.5 17h3" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3V2h6v1" />
      <path d="M8.5 10h7M8.5 13.5h7M8.5 17h4.5" />
    </svg>
  ),
  refund: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15c0 1.1 1.34 2 3 2s3-.9 3-2-1.34-2-3-2-3-.9-3-2 1.34-2 3-2 3 .9 3 2" />
      <path d="M12 7v1.5M12 15.5V17" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'dashboard', show: () => true },
  { href: '/profile', label: 'My Profile', icon: 'profile', show: () => true },
  {
    href: '/users',
    label: 'Users',
    icon: 'users',
    show: (has) => has('user.manage') || has('team.manage') || has('role.assign'),
  },
  { href: '/teams', label: 'Teams', icon: 'teams', show: (has) => has('team.create') || has('team.manage') },
  { href: '/leave', label: 'Leave Applications', icon: 'leave', show: () => true },
  // No refund.* permissions exist on the backend yet (this whole module is
  // still UI-only, see lib/refundMockStore.js) — visible to everyone for now
  // so the pipeline can be reviewed/demoed. Gate this the same way every
  // other item above does (has('refund.view') or similar) once that lands.
  { href: '/refund-applications', label: 'Refund Applications', icon: 'refund', show: () => true },
  { href: '/roles', label: 'Roles & Permissions', icon: 'roles', show: (has) => has('role.create') },
  { href: '/registrations', label: 'Registrations', icon: 'registrations', show: (has) => has('registration.approve') },
  { href: '/system-updates', label: 'System Updates', icon: 'systemUpdates', show: () => true },
  { href: '/holidays', label: 'Public Holidays', icon: 'holidays', show: (has) => has('leave.policy.manage') },
  { href: '/audit-log', label: 'Audit Log', icon: 'audit', show: (has) => has('audit.view') },
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  // Static, developer-controlled — see lib/systemUpdate.config.js /
  // lib/useSystemUpdate.js. No backend call, no permission check.
  const { pending: pendingSystemUpdate, config: systemUpdateConfig } = useSystemUpdateStatus();

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <Image src="/logo.png" alt="IMD HUB" width={40} height={40} priority />
          </div>
          <div className="sidebar-brand-text">
            <div className="name">IMD HUB</div>
            <div className="tag">Internal Staff Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.filter((item) => item.show(hasPermission)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? ' active' : ''}`}
              onClick={onClose}
            >
              <span className="icon">{Icon[item.icon]}</span>
              {item.label}
              {item.href === '/system-updates' && pendingSystemUpdate && (
                <span className="nav-update-badge" title="New system update — click to view">!</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">IMD HUB v{systemUpdateConfig.version}</div>
      </aside>
      <div className={`sidebar-backdrop${open ? ' open' : ''}`} onClick={onClose} />
    </>
  );
}
