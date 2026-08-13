'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
const formatAction = (a) => (a ? a.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
// "LeaveRequest" -> "Leave Request", "PublicHoliday" -> "Public Holiday", ...
const formatTargetType = (t) => (t ? t.replace(/([a-z])([A-Z])/g, '$1 $2') : '—');

// Coarse category filter built from the action-string prefixes actually used
// across the backend (see the recordAudit() call sites in be/src/services/)
// — "leave." matches leave.submit/approve/reject/cancel/medical_return, etc.
// The backend does the actual prefix matching (see audit.service.js
// listAuditLogs); this list just drives the dropdown.
const ACTION_CATEGORIES = [
  { value: '', label: 'All categories' },
  { value: 'auth.', label: 'Authentication' },
  { value: 'role.', label: 'Roles & Permissions' },
  { value: 'registration.', label: 'Registrations' },
  { value: 'leave.', label: 'Leave' },
  { value: 'team.', label: 'Teams' },
  { value: 'user.', label: 'Staff Profiles' },
  { value: 'file.', label: 'Files' },
  { value: 'public_holiday.', label: 'Public Holidays' },
];

// Deliberately not shown here: IP address, user agent, raw metadata JSON.
// Those are developer-facing forensic detail, not something the Manager/
// Department Admin reading this page needs — they're still written to
// audit_logs (see audit.service.js recordAudit) and reachable directly in
// the database if that level of detail is ever needed.
export default function AuditLogPage() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('limit', '500');
    apiFetch(`/audit-logs?${params.toString()}`)
      .then((data) => setLogs(data.logs || []))
      .catch((err) => alertError('Could not load the audit log.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  // Date filters are applied server-side (see audit.service.js), so they
  // trigger a refetch; the text search and category dropdown below just
  // narrow whatever's already been fetched.
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, from, to]);

  const rows = useMemo(() => {
    return logs.filter((l) => {
      if (category && !l.action?.startsWith(category)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${l.actor?.fullName || ''} ${l.actor?.email || ''} ${l.action} ${l.targetName || ''} ${formatTargetType(l.targetType)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, category]);

  const columns = [
    { key: 'createdAt', header: 'When', render: (l) => fmtDateTime(l.createdAt), width: 170 },
    { key: 'actor', header: 'Actor', render: (l) => (l.actor ? l.actor.fullName : 'System / unauthenticated') },
    { key: 'action', header: 'Action', render: (l) => formatAction(l.action) },
    {
      key: 'target',
      header: 'Target',
      // Prefer the resolved name (e.g. "Sarah Tan", "Annual leave — John Doe")
      // over the raw type — see audit.service.js resolveTargetNames. Falls
      // back to just the type label if the record behind it was deleted, and
      // to an em dash for system-level events with no single target.
      render: (l) => l.targetName || (l.targetType ? formatTargetType(l.targetType) : '—'),
    },
  ];

  return (
    <AppShell title="Audit Log">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p>Every permission change, approval/rejection, login, and password reset across the system</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        title="Events"
        emptyMessage="No audit events found for this filter."
        defaultPageSize={20}
        pageSizeOptions={[20, 50, 100]}
        toolbar={
          <>
            <input
              className="filter-input search"
              placeholder="Search actor, action, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {ACTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input type="date" className="filter-select" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="filter-select" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        }
      />
    </AppShell>
  );
}
