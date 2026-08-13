'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, promptText, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import RevealableField from '@/components/RevealableField';

const label = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function RegistrationsPage() {
  const { user: currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState(null);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/registration-requests'),
      apiFetch('/registration-requests/reviewed'),
      apiFetch('/roles/assignable'),
      apiFetch('/teams'),
    ])
      .then(([reqData, reviewedData, roleData, teamData]) => {
        setRequests(reqData.requests || []);
        setReviewed(reviewedData.requests || []);
        setRoles(roleData.roles || []);
        setTeams(teamData.teams || []);
      })
      .catch((err) => alertError('Could not load registration requests.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const rows = useMemo(() => {
    return requests
      .filter((r) => !search || `${r.fullName} ${r.email}`.toLowerCase().includes(search.toLowerCase()))
      .map((r) => ({ ...r, requestedTeamName: r.requestedTeamId ? teamsById[r.requestedTeamId]?.name : null }));
  }, [requests, teamsById, search]);

  // Old records — already accepted or denied, and by whom (see
  // registration.service.js listReviewed, which joins reviewer/
  // requestedRole/requestedTeam directly rather than needing the id
  // cross-reference the pending table above does).
  const historyRows = useMemo(() => {
    return reviewed.filter((r) => {
      if (historyStatusFilter && r.status !== historyStatusFilter) return false;
      if (historySearch) {
        const q = historySearch.toLowerCase();
        if (!`${r.fullName} ${r.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reviewed, historySearch, historyStatusFilter]);

  const handleReject = async (request) => {
    const reason = await promptText('Reject this registration?', {
      text: `${request.fullName} — ${request.email}`,
      placeholder: 'Optional reason (sent to the applicant)...',
      confirmButtonText: 'Reject',
    });
    if (reason === null) return;
    try {
      await apiFetch(`/registration-requests/${request.id}/reject`, { method: 'POST', body: { reason: reason || undefined } });
      toastSuccess('Registration rejected');
      load();
    } catch (err) {
      alertError('Could not reject request.', err.message);
    }
  };

  const columns = [
    { key: 'fullName', header: 'Applicant', render: (r) => <strong>{r.fullName}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'phoneNumber', header: 'Phone', render: (r) => r.phoneNumber || '—' },
    { key: 'requestedTeamName', header: 'Requested team', render: (r) => r.requestedTeamName || 'Not specified' },
    { key: 'createdAt', header: 'Submitted', render: (r) => fmtDate(r.createdAt) },
    {
      key: 'actions', header: '', width: 190,
      render: (r) => (
        <div className="row-actions">
          <button type="button" className="link-btn primary" onClick={() => setReviewing(r)}>Review & Approve</button>
          <button type="button" className="link-btn danger" onClick={() => handleReject(r)}>Reject</button>
        </div>
      ),
    },
  ];

  // Note: this shows what the applicant originally requested, not
  // necessarily what they ended up with — the approver can pick a
  // different role/team at approval time (see ApproveModal), and that
  // final choice lives on the resulting UserRoleAssignment, not back on
  // this request row. For "what does this person actually have now",
  // check their entry on the Users page instead.
  const historyColumns = [
    { key: 'fullName', header: 'Applicant', render: (r) => <strong>{r.fullName}</strong> },
    { key: 'email', header: 'Email' },
    { key: 'requestedTeam', header: 'Requested team', render: (r) => r.requestedTeam?.name || 'Not specified' },
    { key: 'status', header: 'Decision', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'reviewer', header: 'Decided by', render: (r) => r.reviewer?.fullName || '—' },
    { key: 'reviewedAt', header: 'Decided at', render: (r) => fmtDateTime(r.reviewedAt) },
    { key: 'rejectionReason', header: 'Reason', render: (r) => r.rejectionReason || '—' },
  ];

  return (
    <AppShell title="Registrations">
      <div className="page-header">
        <div>
          <h1>Registrations</h1>
          <p>New staff applications, and the full history of past decisions</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        title="Pending"
        emptyMessage="No pending registration requests."
        toolbar={<input className="filter-input search" placeholder="Search applicant..." value={search} onChange={(e) => setSearch(e.target.value)} />}
      />

      <div style={{ height: 24 }} />

      <DataTable
        columns={historyColumns}
        rows={historyRows}
        loading={loading}
        title="Old Registrations"
        emptyMessage="No reviewed registrations yet."
        toolbar={
          <>
            <input
              className="filter-input search"
              placeholder="Search applicant..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
            <select className="filter-select" value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)}>
              <option value="">All decisions</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </>
        }
      />

      {reviewing && (
        <ApproveModal
          request={reviewing}
          roles={roles}
          teams={teams}
          onClose={() => setReviewing(null)}
          onApproved={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function ApproveModal({ request, roles, teams, onClose, onApproved }) {
  const [roleId, setRoleId] = useState(request.requestedRoleId || '');
  const [teamId, setTeamId] = useState(request.requestedTeamId || '');
  const [scopeType, setScopeType] = useState(request.requestedTeamId ? 'team' : 'global');
  const [position, setPosition] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [dateJoined, setDateJoined] = useState('');
  const [staffId, setStaffId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleId) {
      alertError('Missing information', 'Please select a role for this applicant.');
      return;
    }
    if (scopeType === 'team' && !teamId) {
      alertError('Missing information', 'Please select a team for a team-scoped role.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/registration-requests/${request.id}/approve`, {
        method: 'POST',
        body: {
          roleId,
          teamId: teamId || undefined,
          scopeType,
          position: position || undefined,
          employmentType: employmentType || undefined,
          dateJoined: dateJoined || undefined,
          staffId: staffId || undefined,
        },
      });
      toastSuccess('Registration approved');
      onApproved();
    } catch (err) {
      alertError('Could not approve request.', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Review — ${request.fullName}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="approve-form" disabled={saving}>{saving ? 'Approving...' : 'Approve & Create Account'}</button>
        </>
      }
    >
      <div className="permission-category-label">Applicant submitted</div>
      <div className="detail-grid">
        <div className="detail-item"><div className="label">Email</div><div className="value">{request.email}</div></div>
        <div className="detail-item"><div className="label">Phone</div><div className="value">{request.phoneNumber || '—'}</div></div>
        <div className="detail-item"><div className="label">Date of birth</div><div className="value">{fmtDate(request.dateOfBirth)}</div></div>
        <div className="detail-item"><div className="label">Gender</div><div className="value">{label(request.gender)}</div></div>
        <div className="detail-item"><div className="label">Nationality</div><div className="value">{request.nationality || '—'}</div></div>
        <div className="detail-item">
          <div className="label">ID document</div>
          <div className="value">
            {request.idDocumentType ? (
              <>
                {label(request.idDocumentType)} —{' '}
                <RevealableField maskedValue={request.idDocumentNumber} fetchUrl={`/registration-requests/${request.id}/id-document`} />
              </>
            ) : '—'}
          </div>
        </div>
        <div className="detail-item"><div className="label">Address</div><div className="value">{request.address || '—'}</div></div>
        <div className="detail-item"><div className="label">Next of kin</div><div className="value">{request.nextOfKinName ? `${request.nextOfKinName} — ${request.nextOfKinContact}` : '—'}</div></div>
        <div className="detail-item"><div className="label">CV</div><div className="value muted">{request.cvOriginalName || 'Not uploaded'}</div></div>
        <div className="detail-item"><div className="label">Profile photo</div><div className="value muted">{request.profilePhotoOriginalName || 'Not uploaded'}</div></div>
      </div>
      <div className="hint" style={{ marginBottom: 20 }}>Uploaded documents become viewable from the staff profile once this application is approved.</div>

      <div className="permission-category-label">Access to grant</div>
      <form id="approve-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field full">
            <label>Role <span className="required-star">*</span></label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Select...</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Scope</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              <option value="global">Global (all teams)</option>
              <option value="team">Specific team</option>
            </select>
          </div>
          <div className="field">
            <label>Team{scopeType === 'team' && <span className="required-star"> *</span>}</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{request.requestedTeamId ? 'Requested team' : 'No team'}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="permission-category-label">Employment details</div>
        <div className="form-grid">
          <div className="field">
            <label>Staff ID</label>
            <input value={staffId} onChange={(e) => setStaffId(e.target.value)} />
          </div>
          <div className="field">
            <label>Position</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="field">
            <label>Employment type</label>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              <option value="">Select...</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div className="field">
            <label>Date joined</label>
            <input type="date" value={dateJoined} onChange={(e) => setDateJoined(e.target.value)} />
          </div>
        </div>
      </form>
    </Modal>
  );
}
