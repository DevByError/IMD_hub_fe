'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, confirmAction, toastSuccess } from '@/lib/alerts';
import { staffStatusBadgeLabel } from '@/lib/roleUtils';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import AuthImage from '@/components/AuthImage';
import FileLink from '@/components/FileLink';
import RevealableField from '@/components/RevealableField';
import Modal from '@/components/Modal';
import DateOfBirthPicker from '@/components/DateOfBirthPicker';
import { NATIONALITIES } from '@/lib/nationalities';

const label = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

const ADMIN_FIELDS = [
  'fullName', 'idDocumentType', 'idDocumentNumber', 'dateOfBirth', 'position',
  'employmentType', 'dateJoined', 'nationality', 'staffId', 'status', 'staffStatus', 'lastAppraisalDate',
];

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [movingTeam, setMovingTeam] = useState('');
  const [leaveBalances, setLeaveBalances] = useState(null); // null = not loaded / not visible to this viewer

  const canEdit = hasPermission('user.manage') || hasPermission('team.manage');

  const load = () => {
    setLoading(true);
    Promise.all([apiFetch('/users'), apiFetch('/teams')])
      .then(([userData, teamData]) => {
        setUsers(userData.users || []);
        setTeams(teamData.teams || []);
      })
      .catch((err) => alertError('Could not load staff.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's own silent-session check to finish (and set the
  // access token) before firing our first request — otherwise this effect
  // (a child, which mounts/fires before AuthProvider's effect) would race
  // it and produce a real 401 on GET /users before the token exists. See
  // apiClient.js/AuthContext.js for the refresh flow this depends on.
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const teamByUserId = useMemo(() => {
    const map = {};
    teams.forEach((t) => (t.staff || []).forEach((s) => { map[s.id] = { id: t.id, name: t.name }; }));
    return map;
  }, [teams]);

  const rows = useMemo(() => {
    return users
      .map((u) => ({ ...u, team: teamByUserId[u.id] || null }))
      .filter((u) => {
        // The Department Manager isn't "staff" (see spec) — never listed
        // in this directory, only ever visible via their own Profile page.
        if (u.isManager) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = `${u.fullName} ${u.email} ${u.staffId || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (teamFilter && u.team?.id !== teamFilter) return false;
        if (statusFilter && u.status !== statusFilter) return false;
        if (staffStatusFilter && u.staffStatus !== staffStatusFilter) return false;
        return true;
      });
  }, [users, teamByUserId, search, teamFilter, statusFilter, staffStatusFilter]);

  const openDetail = (row) => {
    setSelected(row);
    setEditing(false);
    setMovingTeam(row.team?.id || '');
    setLeaveBalances(null);
    // Not every viewer holds leave.view.* for this person's team — the
    // endpoint 403s in that case, so just leave the section hidden rather
    // than surfacing an error toast for what's really a visibility rule.
    if (!row.isManager) {
      apiFetch(`/leave/balances/${row.id}`)
        .then((data) => setLeaveBalances(data.balances || []))
        .catch(() => setLeaveBalances(null));
    }
  };

  const openEdit = () => {
    const initial = {};
    ADMIN_FIELDS.forEach((f) => { initial[f] = selected[f] || ''; });
    setForm(initial);
    setEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      ADMIN_FIELDS.forEach((f) => { if (form[f] !== '' && form[f] !== undefined) body[f] = form[f]; });
      await apiFetch(`/users/${selected.id}`, { method: 'PATCH', body });
      toastSuccess('Staff record updated');
      setEditing(false);
      setSelected(null);
      load();
    } catch (err) {
      alertError('Update failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTeam = async () => {
    if (!movingTeam || movingTeam === selected.team?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/teams/${movingTeam}/members`, { method: 'POST', body: { userId: selected.id } });
      toastSuccess('Team updated');
      setSelected(null);
      load();
    } catch (err) {
      alertError('Could not update team.', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle for the field that actually gates login (`status` — see
  // auth.service.js, only 'active' is allowed to sign in), not `staffStatus`
  // (the separate HR "currently employed" flag, which has no access
  // effect). Anything other than 'active' — pending, inactive, suspended —
  // reads as "not active" here and offers "Activate"; the full Edit form
  // still has the 4-way dropdown for picking a specific one of those.
  const handleToggleStatus = async () => {
    const activating = selected.status !== 'active';
    const confirmed = await confirmAction(
      activating ? 'Activate this account?' : 'Deactivate this account?',
      activating
        ? `${selected.fullName} will be able to log in again.`
        : `${selected.fullName} will no longer be able to log in.`,
      { confirmButtonText: activating ? 'Activate' : 'Deactivate', danger: !activating }
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiFetch(`/users/${selected.id}`, { method: 'PATCH', body: { status: activating ? 'active' : 'inactive' } });
      toastSuccess(activating ? 'Account activated' : 'Account deactivated');
      setSelected(null);
      load();
    } catch (err) {
      alertError('Could not update status.', err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'photo', header: '', width: 46,
      render: (u) => (
        <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-border)' }}>
          <AuthImage
            src={u.profilePhotoUrl}
            alt={u.fullName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fallback={<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{(u.fullName || '?')[0]}</span>}
          />
        </div>
      ),
    },
    { key: 'fullName', header: 'Name', render: (u) => <strong>{u.fullName}</strong> },
    { key: 'staffId', header: 'Staff ID', render: (u) => u.staffId || '—' },
    { key: 'email', header: 'Email' },
    { key: 'team', header: 'Team', render: (u) => u.team?.name || '—' },
    { key: 'position', header: 'Position', render: (u) => u.position || '—' },
    { key: 'employmentType', header: 'Employment', render: (u) => label(u.employmentType) },
    { key: 'status', header: 'Account', render: (u) => <StatusBadge status={u.status} /> },
    { key: 'staffStatus', header: 'Staff Status', render: (u) => <StatusBadge status={u.staffStatus} /> },
    {
      key: 'actions', header: '', width: 90,
      render: (u) => <button type="button" className="link-btn" onClick={() => openDetail(u)}>View</button>,
    },
  ];

  return (
    <AppShell title="Users">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>All staff visible to your role, with filters for team and status</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        title="Staff"
        onRowClick={openDetail}
        emptyMessage="No staff match these filters."
        toolbar={
          <>
            <input
              className="filter-input search"
              placeholder="Search name, email, staff ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="filter-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All account status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <select className="filter-select" value={staffStatusFilter} onChange={(e) => setStaffStatusFilter(e.target.value)}>
              <option value="">All staff status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </>
        }
      />

      {selected && !editing && (
        <Modal title={selected.fullName} onClose={() => setSelected(null)} wide>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-primary-border)', flexShrink: 0 }}>
              <AuthImage
                src={selected.profilePhotoUrl}
                alt={selected.fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                fallback={<span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 20 }}>{(selected.fullName || '?')[0]}</span>}
              />
            </div>
            <div>
              <div className="subtitle">{selected.email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <StatusBadge status={selected.status} />
                {staffStatusBadgeLabel(selected.roleName) && (
                  <StatusBadge status={selected.staffStatus} label={`${staffStatusBadgeLabel(selected.roleName)}: ${label(selected.staffStatus)}`} />
                )}
              </div>
            </div>
          </div>

          <div className="permission-category-label">Contact</div>
          <div className="detail-grid">
            <div className="detail-item"><div className="label">Phone</div><div className="value">{selected.phoneNumber || '—'}</div></div>
            <div className="detail-item"><div className="label">Address</div><div className="value">{selected.address || '—'}</div></div>
          </div>

          <div className="permission-category-label">Personal Info</div>
          <div className="detail-grid">
            <div className="detail-item"><div className="label">Date of birth</div><div className="value">{fmtDate(selected.dateOfBirth)}</div></div>
            <div className="detail-item"><div className="label">Gender</div><div className="value">{label(selected.gender)}</div></div>
            <div className="detail-item"><div className="label">Nationality</div><div className="value">{selected.nationality || '—'}</div></div>
            <div className="detail-item">
              <div className="label">ID document</div>
              <div className="value">
                {selected.idDocumentType ? (
                  <>
                    {label(selected.idDocumentType)} —{' '}
                    <RevealableField maskedValue={selected.idDocumentNumber} fetchUrl={`/users/${selected.id}/id-document`} />
                  </>
                ) : '—'}
              </div>
            </div>
          </div>

          {!selected.isManager && (
            <>
              <div className="permission-category-label">Employment</div>
              <div className="detail-grid">
                <div className="detail-item"><div className="label">Staff ID</div><div className="value">{selected.staffId || '—'}</div></div>
                <div className="detail-item"><div className="label">Position</div><div className="value">{selected.position || '—'}</div></div>
                <div className="detail-item"><div className="label">Employment type</div><div className="value">{label(selected.employmentType)}</div></div>
                <div className="detail-item"><div className="label">Date joined</div><div className="value">{fmtDate(selected.dateJoined)}</div></div>
                <div className="detail-item"><div className="label">Last appraisal</div><div className="value">{fmtDate(selected.lastAppraisalDate)}</div></div>
              </div>

              <div className="permission-category-label">Next of Kin</div>
              <div className="detail-grid">
                <div className="detail-item"><div className="label">Name</div><div className="value">{selected.nextOfKinName || '—'}</div></div>
                <div className="detail-item"><div className="label">Contact number</div><div className="value">{selected.nextOfKinContact || '—'}</div></div>
              </div>

              <div className="permission-category-label">Documents</div>
              <div className="detail-grid">
                <div className="detail-item"><div className="label">CV</div><FileLink src={selected.cvUrl}>View CV</FileLink></div>
              </div>
            </>
          )}

          {canEdit && (
            <>
              {selected.isManager ? (
                <>
                  <div className="permission-category-label">Team</div>
                  <div className="hint" style={{ marginBottom: 20 }}>
                    The Department Manager account isn&apos;t assigned to a team — it sits outside the team structure entirely.
                  </div>
                </>
              ) : (
                <>
                  <div className="permission-category-label">Team</div>
                  <div className="form-grid">
                    <div className="field">
                      <select value={movingTeam} onChange={(e) => setMovingTeam(e.target.value)}>
                        <option value="">No team</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <button type="button" className="btn" disabled={saving || movingTeam === (selected.team?.id || '')} onClick={handleMoveTeam}>
                        {saving ? 'Saving...' : 'Move to team'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {leaveBalances && leaveBalances.length > 0 && (
            <>
              <div className="permission-category-label">Leave Balance</div>
              <div className="detail-grid">
                {leaveBalances.map((b) => (
                  <div className="detail-item" key={b.leaveType}>
                    <div className="label">{label(b.leaveType)} leave</div>
                    <div className="value">
                      {b.entitledDays} day(s) entitled — {b.remainingDays} remaining
                      {b.leaveType === 'medical' && Number(b.unpaidDays) > 0 && (
                        <> — <span className="badge badge-red">{b.unpaidDays} unpaid</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {canEdit && !selected.isManager && (
            <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none', display: 'flex', gap: 10 }}>
              <button type="button" className="btn" onClick={openEdit}>Edit staff record</button>
              <button
                type="button"
                className={selected.status === 'active' ? 'link-btn danger' : 'link-btn'}
                onClick={handleToggleStatus}
                disabled={saving}
              >
                {selected.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          )}

          {canEdit && selected.isManager && (
            <div className="modal-footer" style={{ padding: '20px 0 0', border: 'none' }}>
              <button type="button" className="btn" onClick={openEdit}>Edit staff record</button>
            </div>
          )}
        </Modal>
      )}

      {selected && editing && form && (
        <Modal
          title={`Edit ${selected.fullName}`}
          onClose={() => setEditing(false)}
          wide
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setEditing(false)}>Back</button>
              <button type="submit" form="edit-user-form" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
            </>
          }
        >
          <form onSubmit={handleSave} id="edit-user-form">
            <div className="form-grid">
              <div className="field">
                <label>Full name</label>
                <input name="fullName" value={form.fullName} onChange={handleChange} />
              </div>
              {!selected.isManager && (
                <>
                  <div className="field">
                    <label>Staff ID</label>
                    <input name="staffId" value={form.staffId} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Position</label>
                    <input name="position" value={form.position} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Employment type</label>
                    <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                </>
              )}
              <div className="field">
                <label>Nationality</label>
                <select name="nationality" value={form.nationality} onChange={handleChange}>
                  <option value="">Select...</option>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field">
                <label>ID document type</label>
                <select name="idDocumentType" value={form.idDocumentType} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="ic">IC (local)</option>
                  <option value="passport">Passport (foreign)</option>
                </select>
              </div>
              <div className="field">
                <label>ID document number</label>
                <input name="idDocumentNumber" value={form.idDocumentNumber} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Account status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="field">
                <label>Staff status</label>
                <select name="staffStatus" value={form.staffStatus} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="field full">
                <label>Date of birth</label>
                <DateOfBirthPicker value={form.dateOfBirth} onChange={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))} idPrefix="u-dob" />
              </div>
              {!selected.isManager && (
                <>
                  <div className="field full">
                    <label>Date joined</label>
                    <DateOfBirthPicker value={form.dateJoined} onChange={(v) => setForm((p) => ({ ...p, dateJoined: v }))} idPrefix="u-joined" />
                  </div>
                  <div className="field full">
                    <label>Last appraisal date</label>
                    <DateOfBirthPicker value={form.lastAppraisalDate} onChange={(v) => setForm((p) => ({ ...p, lastAppraisalDate: v }))} idPrefix="u-appraisal" />
                  </div>
                </>
              )}
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
