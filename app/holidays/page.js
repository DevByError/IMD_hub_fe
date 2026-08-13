'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, confirmAction, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function HolidaysPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const canManage = hasPermission('leave.policy.manage');

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const [creating, setCreating] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiFetch('/public-holidays')
      .then((data) => setHolidays(data.holidays || []))
      .catch((err) => alertError('Could not load public holidays.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const years = useMemo(() => {
    const set = new Set(holidays.map((h) => new Date(h.date).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [holidays]);

  const rows = useMemo(() => {
    return holidays.filter((h) => {
      if (search && !h.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (yearFilter && String(new Date(h.date).getFullYear()) !== yearFilter) return false;
      return true;
    });
  }, [holidays, search, yearFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!date || !name.trim()) {
      alertError('Missing information', 'Please enter both a date and a name.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/public-holidays', { method: 'POST', body: { date, name: name.trim() } });
      toastSuccess('Public holiday added');
      setCreating(false);
      setDate('');
      setName('');
      load();
    } catch (err) {
      alertError('Could not add public holiday.', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holiday) => {
    const ok = await confirmAction('Remove this public holiday?', `"${holiday.name}" (${fmtDate(holiday.date)}) will no longer be excluded from leave day calculations.`, { confirmButtonText: 'Remove' });
    if (!ok) return;
    try {
      await apiFetch(`/public-holidays/${holiday.id}`, { method: 'DELETE' });
      toastSuccess('Public holiday removed');
      load();
    } catch (err) {
      alertError('Could not remove public holiday.', err.message);
    }
  };

  const columns = [
    { key: 'date', header: 'Date', render: (h) => fmtDate(h.date) },
    { key: 'name', header: 'Name', render: (h) => <strong>{h.name}</strong> },
    ...(canManage
      ? [{
          key: 'actions', header: '', width: 90,
          render: (h) => <button type="button" className="link-btn danger" onClick={() => handleDelete(h)}>Remove</button>,
        }]
      : []),
  ];

  return (
    <AppShell title="Public Holidays">
      <div className="page-header">
        <div>
          <h1>Public Holidays</h1>
          <p>These dates are excluded from every leave day calculation across the app</p>
        </div>
        {canManage && (
          <div className="page-header-actions">
            <button type="button" className="btn" onClick={() => setCreating(true)}>+ Add Holiday</button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        title="Holiday Calendar"
        emptyMessage="No public holidays match these filters."
        toolbar={
          <>
            <input className="filter-input search" placeholder="Search name..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="filter-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        }
      />

      {creating && (
        <Modal
          title="Add Public Holiday"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" form="create-holiday-form" disabled={saving}>{saving ? 'Adding...' : 'Add holiday'}</button>
            </>
          }
        >
          <form id="create-holiday-form" onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="field">
                <label>Date <span className="required-star">*</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Name <span className="required-star">*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. National Day" />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
