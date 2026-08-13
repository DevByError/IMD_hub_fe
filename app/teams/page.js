'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, confirmAction, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';

export default function TeamsPage() {
  const { user: currentUser, hasPermission, canManageTeam } = useAuth();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(null);
  const [addingUserId, setAddingUserId] = useState('');

  const canCreate = hasPermission('team.create');
  // Whether the CURRENT staff being managed in the modal is one this user is
  // actually authorized to touch — a Team Admin scoped to one team must not
  // even see "Manage"/"Remove"/"Add" controls for a different team, even
  // though they do hold team.manage in general. The backend already rejects
  // the underlying calls (requirePermission('team.manage', { scopeParam })),
  // this just keeps the UI from dangling a button that would 403.
  const canManageSelected = (teamId) => canCreate || canManageTeam(teamId);

  const load = () => {
    setLoading(true);
    Promise.all([apiFetch('/teams'), apiFetch('/users').catch(() => ({ users: [] }))])
      .then(([teamData, userData]) => {
        setTeams(teamData.teams || []);
        setUsers(userData.users || []);
      })
      .catch((err) => alertError('Could not load teams.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (selected) {
      const fresh = teams.find((t) => t.id === selected.id);
      if (fresh) setSelected(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const rows = useMemo(() => {
    return teams
      .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()))
      .map((t) => ({ ...t, memberCount: (t.staff || []).length }));
  }, [teams, search]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/teams', { method: 'POST', body: { name: newTeamName.trim() } });
      toastSuccess('Team created');
      setCreating(false);
      setNewTeamName('');
      load();
    } catch (err) {
      alertError('Could not create team.', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (team) => {
    const ok = await confirmAction('Delete this team?', `"${team.name}" will be permanently removed.`, { confirmButtonText: 'Delete' });
    if (!ok) return;
    try {
      await apiFetch(`/teams/${team.id}`, { method: 'DELETE' });
      toastSuccess('Team deleted');
      setSelected(null);
      load();
    } catch (err) {
      alertError('Could not delete team.', err.message);
    }
  };

  const handleAddMember = async () => {
    if (!addingUserId) return;
    try {
      await apiFetch(`/teams/${selected.id}/members`, { method: 'POST', body: { userId: addingUserId } });
      toastSuccess('Staff member added');
      setAddingUserId('');
      load();
    } catch (err) {
      alertError('Could not add member.', err.message);
    }
  };

  const handleRemoveMember = async (userId, name) => {
    const ok = await confirmAction('Remove from team?', `${name} will be removed from "${selected.name}".`, { confirmButtonText: 'Remove' });
    if (!ok) return;
    try {
      await apiFetch(`/teams/${selected.id}/members/${userId}`, { method: 'DELETE' });
      toastSuccess('Staff member removed');
      load();
    } catch (err) {
      alertError('Could not remove member.', err.message);
    }
  };

  const availableUsers = useMemo(() => {
    if (!selected) return [];
    const memberIds = new Set((selected.staff || []).map((s) => s.id));
    // The Department Manager is never assignable as team staff (see
    // team.service.js setStaffTeam) — filtered here too so they don't even
    // show up as a pickable option.
    return users.filter((u) => !memberIds.has(u.id) && !u.isManager);
  }, [users, selected]);

  const columns = [
    { key: 'name', header: 'Team name', render: (t) => <strong>{t.name}</strong> },
    { key: 'memberCount', header: 'Members', render: (t) => `${t.memberCount} staff` },
    { key: 'createdAt', header: 'Created', render: (t) => new Date(t.createdAt).toLocaleDateString() },
    {
      key: 'actions', header: '', width: 200,
      render: (t) => (
        <div className="row-actions">
          {canManageSelected(t.id) ? (
            <button type="button" className="link-btn" onClick={() => setSelected(t)}>Manage</button>
          ) : (
            <span className="hint">No access</span>
          )}
          {canCreate && (
            <button type="button" className="link-btn danger" onClick={() => handleDelete(t)}>Delete</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Teams">
      <div className="page-header">
        <div>
          <h1>Teams</h1>
          <p>Create teams and manage which staff belong to each one</p>
        </div>
        {canCreate && (
          <div className="page-header-actions">
            <button type="button" className="btn" onClick={() => setCreating(true)}>+ New Team</button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        title="Teams"
        emptyMessage="No teams match your search."
        toolbar={
          <input className="filter-input search" placeholder="Search teams..." value={search} onChange={(e) => setSearch(e.target.value)} />
        }
      />

      {creating && (
        <Modal
          title="New Team"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" form="create-team-form" disabled={saving}>{saving ? 'Creating...' : 'Create Team'}</button>
            </>
          }
        >
          <form id="create-team-form" onSubmit={handleCreate}>
            <div className="field">
              <label>Team name</label>
              <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} autoFocus />
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)} wide>
          <div className="permission-category-label">Members ({(selected.staff || []).length})</div>
          {(selected.staff || []).length === 0 ? (
            <div className="empty-state">No staff assigned to this team yet.</div>
          ) : (
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead><tr><th>Name</th><th>Email</th>{canManageSelected(selected.id) && <th />}</tr></thead>
              <tbody>
                {selected.staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.fullName}</td>
                    <td>{s.email}</td>
                    {canManageSelected(selected.id) && (
                      <td>
                        <button type="button" className="link-btn danger" onClick={() => handleRemoveMember(s.id, s.fullName)}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canManageSelected(selected.id) && (
            <>
              <div className="permission-category-label">Add staff to this team</div>
              <div className="form-grid">
                <div className="field">
                  <select value={addingUserId} onChange={(e) => setAddingUserId(e.target.value)}>
                    <option value="">Select staff member...</option>
                    {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                  </select>
                </div>
                <div className="field">
                  <button type="button" className="btn" disabled={!addingUserId} onClick={handleAddMember}>Add to team</button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </AppShell>
  );
}
