'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import AppShell from '@/components/AppShell';

const StatIcon = {
  leave: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c1.2-3.6 3.8-5 6.5-5s5.3 1.4 6.5 5" />
    </svg>
  ),
  teams: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
    </svg>
  ),
  pending: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

function StatCard({ icon, value, label, href }) {
  const content = (
    <div className="stat-card">
      <div className="stat-card-icon">{StatIcon[icon]}</div>
      <div>
        <div className="value">{value}</div>
        <div className="label">{label}</div>
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link> : content;
}

export default function DashboardPage() {
  const { user, roles, hasPermission } = useAuth();
  const [stats, setStats] = useState({ pendingLeave: null, teams: null, staff: null, pendingRegistrations: null });
  const [balances, setBalances] = useState(null);

  const isManager = roles?.some((r) => r.roleName === 'Department Manager');

  useEffect(() => {
    if (!user) return;

    apiFetch('/leave/my-requests')
      .then((data) => setStats((s) => ({ ...s, pendingLeave: (data.requests || []).filter((r) => r.status === 'pending').length })))
      .catch(() => {});

    apiFetch('/teams')
      .then((data) => setStats((s) => ({ ...s, teams: (data.teams || []).length })))
      .catch(() => {});

    if (hasPermission('user.manage') || hasPermission('team.manage') || hasPermission('role.assign')) {
      apiFetch('/users')
        .then((data) => setStats((s) => ({ ...s, staff: (data.users || []).filter((u) => !u.isManager).length })))
        .catch(() => {});
    }

    if (hasPermission('registration.approve')) {
      apiFetch('/registration-requests')
        .then((data) => setStats((s) => ({ ...s, pendingRegistrations: (data.requests || []).length })))
        .catch(() => {});
    }

    if (!isManager) {
      apiFetch('/leave/my-balances')
        .then((data) => setBalances(data.balances || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <AppShell title="Dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.fullName?.split(' ')[0]}</h1>
          <p>{roles?.map((r) => r.roleName).join(', ') || 'Staff'} · {user?.email}</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="leave" value={stats.pendingLeave ?? '—'} label="My pending leave requests" href="/leave" />
        <StatCard icon="teams" value={stats.teams ?? '—'} label="Teams" href="/teams" />
        {(hasPermission('user.manage') || hasPermission('team.manage') || hasPermission('role.assign')) && (
          <StatCard icon="users" value={stats.staff ?? '—'} label="Staff members" href="/users" />
        )}
        {hasPermission('registration.approve') && (
          <StatCard icon="pending" value={stats.pendingRegistrations ?? '—'} label="Pending registrations" href="/registrations" />
        )}
      </div>

      {!isManager && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>My Leave Balance</h2>
              <div className="subtitle">Remaining days for this year</div>
            </div>
            <Link href="/leave" className="link-btn primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Apply for leave
            </Link>
          </div>
          {!balances ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading...</p>
          ) : balances.length === 0 ? (
            <div className="empty-state">No tracked leave balances yet.</div>
          ) : (
            <div className="detail-grid">
              {balances.map((b) => (
                <div className="detail-item" key={b.leaveType}>
                  <div className="label">{b.leaveType} leave</div>
                  <div className="value">
                    {b.remainingDays} of {b.entitledDays + b.carriedOverDays} day(s) remaining
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Quick links</h2>
        </div>
        <div className="page-header-actions" style={{ flexWrap: 'wrap' }}>
          <Link href="/profile" className="link-btn" style={{ textDecoration: 'none' }}>My Profile</Link>
          <Link href="/leave" className="link-btn" style={{ textDecoration: 'none' }}>Leave Applications</Link>
          {(hasPermission('team.create') || hasPermission('team.manage')) && (
            <Link href="/teams" className="link-btn" style={{ textDecoration: 'none' }}>Manage Teams</Link>
          )}
          {hasPermission('role.create') && (
            <Link href="/roles" className="link-btn" style={{ textDecoration: 'none' }}>Roles & Permissions</Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
