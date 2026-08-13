'use client';

// Every status string used anywhere in the app (account status, staff
// status, leave request status, role-assignment status, registration
// status) mapped to one of five badge colors. Add new statuses here rather
// than inlining color logic on individual pages, so a given word always
// reads the same way everywhere.
const COLOR_MAP = {
  active: 'green',
  approved: 'green',
  accepted: 'green',
  assigned: 'green',

  pending: 'amber',
  in_review: 'amber',
  awaiting_return: 'amber',
  pending_marketing: 'amber',
  pending_accept: 'amber',
  pending_approve: 'amber',
  pending_accounts: 'amber',

  rejected: 'red',
  suspended: 'red',
  revoked: 'red',
  expired: 'red',

  inactive: 'gray',
  cancelled: 'gray',
  full_time: 'black',
  part_time: 'gray',
  contract: 'amber',

  system: 'black',
  custom: 'green',
  completed: 'green',
};

const humanize = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function StatusBadge({ status, label }) {
  if (!status && !label) return <span className="badge badge-gray">—</span>;
  const color = (status && COLOR_MAP[status]) || 'gray';
  return <span className={`badge badge-${color}`}>{label || humanize(status)}</span>;
}
