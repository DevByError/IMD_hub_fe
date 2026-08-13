'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, confirmAction, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const MANAGER_ROLE_NAME = 'Department Manager';
const label = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

// datetime-local gives "2026-08-01T09:00"; the API wants a full ISO string.
const toIsoOrUndefined = (localValue) => (localValue ? new Date(localValue).toISOString() : undefined);

export default function RolesPage() {
  const { user: currentUser } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [roleModal, setRoleModal] = useState(null); // { mode: 'create' | 'edit', role? }
  const [assignSearch, setAssignSearch] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [historyRoleFilter, setHistoryRoleFilter] = useState('');
  const [historyActionFilter, setHistoryActionFilter] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      apiFetch('/roles'),
      apiFetch('/roles/permissions?delegableOnly=true'),
      apiFetch('/roles/assignments'),
      apiFetch('/roles/assignments/history'),
      apiFetch('/users'),
      apiFetch('/teams'),
    ])
      .then(([roleData, permData, assignData, historyData, userData, teamData]) => {
        setRoles(roleData.roles || []);
        setPermissions(permData.permissions || []);
        setAssignments(assignData.assignments || []);
        setHistory(historyData.history || []);
        setUsers(userData.users || []);
        setTeams(teamData.teams || []);
      })
      .catch((err) => alertError('Could not load roles.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const handleDeleteRole = async (role) => {
    const ok = await confirmAction('Delete this role?', `"${role.name}" will be permanently removed. This only works if no one currently holds it.`, { confirmButtonText: 'Delete' });
    if (!ok) return;
    try {
      await apiFetch(`/roles/${role.id}`, { method: 'DELETE' });
      toastSuccess('Role deleted');
      load();
    } catch (err) {
      alertError('Could not delete role.', err.message);
    }
  };

  const handleRevoke = async (assignment) => {
    const ok = await confirmAction('Revoke this role assignment?', `${usersById[assignment.userId]?.fullName || 'This user'} will lose the "${assignment.role.name}" role.`, { confirmButtonText: 'Revoke' });
    if (!ok) return;
    try {
      await apiFetch(`/roles/assignments/${assignment.id}`, { method: 'DELETE' });
      toastSuccess('Assignment revoked');
      load();
    } catch (err) {
      alertError('Could not revoke assignment.', err.message);
    }
  };

  const roleColumns = [
    {
      key: 'name', header: 'Role name',
      render: (r) => (
        <>
          <strong>{r.name}</strong>{' '}
          {r.name === MANAGER_ROLE_NAME && <span className="badge badge-black" style={{ marginLeft: 6 }}>Manager only</span>}
        </>
      ),
    },
    { key: 'permissions', header: 'Permissions', render: (r) => `${r.permissions.length} granted` },
    { key: 'isSystemRole', header: 'Type', render: (r) => <StatusBadge status={r.isSystemRole ? 'system' : 'custom'} /> },
    {
      key: 'actions', header: '', width: 180,
      render: (r) => (
        <div className="row-actions">
          {r.name !== MANAGER_ROLE_NAME && (
            <button type="button" className="link-btn" onClick={() => setRoleModal({ mode: 'edit', role: r })}>Edit</button>
          )}
          {!r.isSystemRole && (
            <button type="button" className="link-btn danger" onClick={() => handleDeleteRole(r)}>Delete</button>
          )}
        </div>
      ),
    },
  ];

  // Only each user's CURRENT (active) role lives here — this table is a
  // live snapshot, not a log. Every past grant/revoke, including roles a
  // person no longer holds, is preserved in the Role Assignment History
  // table below instead of cluttering this one with stale rows.
  const assignmentRows = useMemo(() => {
    return assignments
      .filter((a) => a.status === 'active')
      .map((a) => ({ ...a, userName: usersById[a.userId]?.fullName || 'Unknown user', teamName: a.scopeId ? teamsById[a.scopeId]?.name : null }))
      .filter((a) => {
        // The Department Manager's own role assignment is a bootstrap
        // artifact, not something anyone manages from this screen — hide it.
        if (a.role?.name === MANAGER_ROLE_NAME) return false;
        if (assignSearch && !a.userName.toLowerCase().includes(assignSearch.toLowerCase())) return false;
        if (assignRoleFilter && a.roleId !== assignRoleFilter) return false;
        return true;
      });
  }, [assignments, usersById, teamsById, assignSearch, assignRoleFilter]);

  const assignmentColumns = [
    { key: 'userName', header: 'User', render: (a) => <strong>{a.userName}</strong> },
    { key: 'role', header: 'Role', render: (a) => a.role.name },
    { key: 'scope', header: 'Scope', render: (a) => (a.scopeType === 'team' ? a.teamName || 'Team' : 'Global') },
    { key: 'validUntil', header: 'Valid until', render: (a) => (a.validUntil ? fmtDateTime(a.validUntil) : 'Indefinite') },
    {
      key: 'actions', header: '', width: 90,
      render: (a) => (
        <button type="button" className="link-btn danger" onClick={() => handleRevoke(a)}>Revoke</button>
      ),
    },
  ];

  // --- Role Assignment History (audit trail of every assign/revoke action) ---

  const historyRows = useMemo(() => {
    return history
      .map((h) => {
        const affectedUserId = h.action === 'role.assign' ? h.targetId : h.metadata?.userId;
        const roleId = h.metadata?.roleId;
        const scopeType = h.metadata?.scopeType;
        const scopeId = h.metadata?.scopeId;
        return {
          ...h,
          userName: usersById[affectedUserId]?.fullName || 'Unknown user',
          roleId,
          roleName: roles.find((r) => r.id === roleId)?.name || 'Unknown role',
          scopeLabel: scopeType === 'team' ? teamsById[scopeId]?.name || 'Team' : 'Global',
          durationLabel: h.metadata?.validUntil ? `Until ${fmtDateTime(h.metadata.validUntil)}` : 'Indefinite',
          actorName: h.actor?.fullName || usersById[h.actorUserId]?.fullName || 'System',
        };
      })
      .filter((h) => {
        if (historySearch && !h.userName.toLowerCase().includes(historySearch.toLowerCase())) return false;
        if (historyRoleFilter && h.roleId !== historyRoleFilter) return false;
        if (historyActionFilter && h.action !== historyActionFilter) return false;
        return true;
      });
  }, [history, usersById, teamsById, roles, historySearch, historyRoleFilter, historyActionFilter]);

  const historyColumns = [
    { key: 'createdAt', header: 'Date', render: (h) => fmtDateTime(h.createdAt) },
    { key: 'userName', header: 'User', render: (h) => <strong>{h.userName}</strong> },
    { key: 'action', header: 'Action', render: (h) => <StatusBadge status={h.action === 'role.assign' ? 'assigned' : 'revoked'} /> },
    { key: 'roleName', header: 'Role', render: (h) => h.roleName },
    { key: 'scopeLabel', header: 'Scope', render: (h) => h.scopeLabel },
    { key: 'durationLabel', header: 'Duration', render: (h) => h.durationLabel },
    { key: 'actorName', header: 'Performed by', render: (h) => h.actorName },
  ];

  return (
    <AppShell title="Roles & Permissions">
      <div className="page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Build permission bundles and assign them to staff, permanently or for a limited time</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn" onClick={() => setRoleModal({ mode: 'create' })}>+ New Role</button>
          <button type="button" className="btn" onClick={() => setAssigning(true)}>+ Assign Role</button>
        </div>
      </div>

      <DataTable columns={roleColumns} rows={roles} loading={loading} title="Roles" emptyMessage="No roles yet." pageSizeOptions={[5, 10, 20]} defaultPageSize={5} />

      <div style={{ height: 24 }} />

      <DataTable
        columns={assignmentColumns}
        rows={assignmentRows}
        loading={loading}
        title="Role Assignments"
        emptyMessage="No assignments match these filters."
        toolbar={
          <>
            <input className="filter-input search" placeholder="Search user..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
            <select className="filter-select" value={assignRoleFilter} onChange={(e) => setAssignRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.filter((r) => r.name !== MANAGER_ROLE_NAME).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </>
        }
      />

      <div style={{ height: 24 }} />

      <DataTable
        columns={historyColumns}
        rows={historyRows}
        loading={loading}
        title="Role Assignment History"
        emptyMessage="No role changes match these filters."
        toolbar={
          <>
            <input className="filter-input search" placeholder="Search user..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
            <select className="filter-select" value={historyRoleFilter} onChange={(e) => setHistoryRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roles.filter((r) => r.name !== MANAGER_ROLE_NAME).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select className="filter-select" value={historyActionFilter} onChange={(e) => setHistoryActionFilter(e.target.value)}>
              <option value="">All actions</option>
              <option value="role.assign">Assigned</option>
              <option value="role.revoke">Revoked</option>
            </select>
          </>
        }
      />

      {roleModal && (
        <RoleFormModal
          mode={roleModal.mode}
          role={roleModal.role}
          permissions={permissions}
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            setRoleModal(null);
            load();
          }}
        />
      )}

      {assigning && (
        <AssignRoleModal
          users={users}
          roles={roles}
          teams={teams}
          onClose={() => setAssigning(false)}
          onSaved={() => {
            setAssigning(false);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function RoleFormModal({ mode, role, permissions, onClose, onSaved }) {
  const [name, setName] = useState(role?.name || '');
  const [selectedIds, setSelectedIds] = useState(new Set((role?.permissions || []).filter((p) => p.isDelegable).map((p) => p.id)));
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const byCategory = {};
    permissions.forEach((p) => {
      byCategory[p.category] = byCategory[p.category] || [];
      byCategory[p.category].push(p);
    });
    return byCategory;
  }, [permissions]);

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'create' && !name.trim()) {
      alertError('Missing information', 'Please enter a role name.');
      return;
    }
    setSaving(true);
    try {
      const permissionIds = [...selectedIds];
      if (mode === 'create') {
        await apiFetch('/roles', { method: 'POST', body: { name: name.trim(), permissionIds } });
        toastSuccess('Role created');
      } else {
        await apiFetch(`/roles/${role.id}/permissions`, { method: 'PATCH', body: { permissionIds } });
        toastSuccess('Role permissions updated');
      }
      onSaved();
    } catch (err) {
      alertError('Could not save role.', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === 'create' ? 'New Role' : `Edit Permissions — ${role.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="role-form" disabled={saving}>{saving ? 'Saving...' : 'Save role'}</button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit}>
        {mode === 'create' && (
          <div className="field">
            <label>Role name <span className="required-star">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        )}

        <div className="field" style={{ marginTop: mode === 'create' ? 8 : 0 }}>
          <label>Permissions</label>
          {Object.entries(grouped).map(([category, perms]) => (
            <div key={category}>
              <div className="permission-category-label">{label(category)}</div>
              <div className="checkbox-grid">
                {perms.map((p) => (
                  <label key={p.id} className={`checkbox-row${selectedIds.has(p.id) ? ' checked' : ''}`}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} />
                    {p.description || p.key}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}

function AssignRoleModal({ users, roles, teams, onClose, onSaved }) {
  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [scopeType, setScopeType] = useState('global');
  const [scopeId, setScopeId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  // Only roles that don't carry any non-delegable permission can be handed
  // out this way — mirrors the server-side rule (assertRoleIsAssignable) so
  // the dropdown doesn't offer a choice that will just get rejected.
  const assignableRoles = useMemo(() => roles.filter((r) => r.permissions.every((p) => p.isDelegable)), [roles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !roleId) {
      alertError('Missing information', 'Please select a user and a role.');
      return;
    }
    if (scopeType === 'team' && !scopeId) {
      alertError('Missing information', 'Please select a team for a team-scoped assignment.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/roles/assignments', {
        method: 'POST',
        body: {
          userId,
          roleId,
          scopeType,
          scopeId: scopeType === 'team' ? scopeId : undefined,
          validUntil: toIsoOrUndefined(validUntil),
        },
      });
      toastSuccess('Role assigned');
      onSaved();
    } catch (err) {
      alertError('Could not assign role.', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Assign Role"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="assign-role-form" disabled={saving}>{saving ? 'Assigning...' : 'Assign'}</button>
        </>
      }
    >
      <form id="assign-role-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field full">
            <label>User <span className="required-star">*</span></label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select...</option>
              {users.filter((u) => !u.isManager).map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
            </select>
          </div>
          <div className="field full">
            <label>Role <span className="required-star">*</span></label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Select...</option>
              {assignableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Scope</label>
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
              <option value="global">Global (all teams)</option>
              <option value="team">Specific team</option>
            </select>
          </div>
          {scopeType === 'team' && (
            <div className="field">
              <label>Team <span className="required-star">*</span></label>
              <select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                <option value="">Select...</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="field full">
            <label>Valid until (optional)</label>
            <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            <div className="hint">Leave blank for an indefinite assignment.</div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
