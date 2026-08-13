'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch, apiFetchForm } from '@/lib/apiClient';
import { alertError, confirmAction, promptText, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import FileLink from '@/components/FileLink';
import Modal from '@/components/Modal';
import FileUploadField from '@/components/FileUploadField';

const label = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

// Rough client-side estimate of working days between two dates (Mon–Fri) —
// just to give the applicant a live preview while filling the form; the
// backend recomputes this authoritatively (and also excludes public
// holidays) when the request is actually submitted.
const estimateWorkingDays = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
};

export default function LeavePage() {
  const { user: currentUser, roles, permissions, hasPermission } = useAuth();
  const isManager = roles?.some((r) => r.roleName === 'Department Manager');
  const canReview = permissions?.some((p) => p.startsWith('leave.view.') || p.startsWith('leave.approve.'));
  const canOverride = hasPermission('leave.override');
  const canApproveMedical = hasPermission('leave.approve.medical');

  // isManager comes from `roles`, which is still empty on the very first
  // render (before AuthContext finishes loading) — so this initializer can't
  // reliably default to 'review' for a Manager. `effectiveTab` below
  // corrects for that on every render instead of relying on this initial
  // value being right.
  const [tab, setTab] = useState('my');
  const effectiveTab = isManager ? 'review' : tab;
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');

  const [applying, setApplying] = useState(false);
  const [recordingReturn, setRecordingReturn] = useState(null); // the request row being closed out

  const load = () => {
    setLoading(true);
    const calls = [apiFetch('/leave/types')];
    if (!isManager) {
      calls.push(apiFetch('/leave/my-balances'), apiFetch('/leave/my-requests'));
    } else {
      calls.push(Promise.resolve({ balances: [] }), Promise.resolve({ requests: [] }));
    }
    if (canReview) calls.push(apiFetch('/leave/requests/review'));

    Promise.all(calls)
      .then(([typesData, balanceData, myData, reviewData]) => {
        setLeaveTypes(typesData.leaveTypes || []);
        setBalances(balanceData.balances || []);
        setMyRequests(myData.requests || []);
        if (reviewData) setReviewRequests(reviewData.requests || []);
      })
      .catch((err) => alertError('Could not load leave data.', err.message))
      .finally(() => setLoading(false));
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js).
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const filterRows = (rows) =>
    rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.leaveType?.name !== typeFilter) return false;
      if (applicantFilter && effectiveTab === 'review') {
        const q = applicantFilter.toLowerCase();
        if (!`${r.applicant?.fullName} ${r.applicant?.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });

  const myRows = useMemo(() => filterRows(myRequests), [myRequests, statusFilter, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const reviewRows = useMemo(() => filterRows(reviewRequests), [reviewRequests, statusFilter, typeFilter, applicantFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecide = async (request, decision) => {
    const verb = decision === 'approve' ? 'Approve' : 'Reject';
    const comment = await promptText(`${verb} this ${label(request.leaveType.name)} leave request?`, {
      text: `${request.applicant?.fullName} — ${fmtDate(request.startDate)} to ${fmtDate(request.endDate)} (${request.totalDays} day(s))`,
      placeholder: 'Optional comment...',
      confirmButtonText: verb,
    });
    if (comment === null) return;
    try {
      await apiFetch(`/leave/requests/${request.id}/${decision}`, { method: 'POST', body: { comment: comment || undefined } });
      toastSuccess(`Request ${decision === 'approve' ? 'approved' : 'rejected'}`);
      load();
    } catch (err) {
      alertError('Could not update request.', err.message);
    }
  };

  const handleCancel = async (request) => {
    const ok = await confirmAction('Cancel this leave request?', `${request.applicant?.fullName || 'This staff member'}'s ${label(request.leaveType.name)} leave will be cancelled.`, { confirmButtonText: 'Cancel Request' });
    if (!ok) return;
    try {
      await apiFetch(`/leave/requests/${request.id}/cancel`, { method: 'POST' });
      toastSuccess('Request cancelled');
      load();
    } catch (err) {
      alertError('Could not cancel request.', err.message);
    }
  };

  const baseColumns = [
    { key: 'leaveType', header: 'Type', render: (r) => label(r.leaveType?.name) },
    { key: 'startDate', header: 'Start', render: (r) => fmtDate(r.startDate) },
    { key: 'endDate', header: 'End', render: (r) => (r.status === 'awaiting_return' ? '— (pending)' : fmtDate(r.endDate)) },
    { key: 'totalDays', header: 'Days', render: (r) => (r.totalDays === null || r.totalDays === undefined ? '—' : r.totalDays) },
    {
      key: 'unpaidDays', header: 'Unpaid',
      render: (r) => (Number(r.unpaidDays) > 0 ? <span className="badge badge-red">{r.unpaidDays}</span> : '—'),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'reviewer', header: 'Reviewed by', render: (r) => r.reviewer?.fullName || '—' },
    {
      key: 'attachments', header: 'MC', width: 70,
      render: (r) => (r.attachments?.length ? <FileLink src={r.attachments[0].fileUrl}>MC</FileLink> : '—'),
    },
  ];

  const myColumns = [
    ...baseColumns,
    {
      key: 'actions', header: '', width: 110,
      render: (r) => canOverride && ['pending', 'approved', 'awaiting_return'].includes(r.status) ? (
        <button type="button" className="link-btn danger" onClick={() => handleCancel(r)}>Cancel</button>
      ) : null,
    },
  ];

  const reviewColumns = [
    { key: 'applicant', header: 'Applicant', render: (r) => <strong>{r.applicant?.fullName}</strong> },
    ...baseColumns,
    {
      key: 'actions', header: '', width: 190,
      render: (r) => (
        <div className="row-actions">
          {r.status === 'pending' && (
            <>
              <button type="button" className="link-btn primary" onClick={() => handleDecide(r, 'approve')}>Approve</button>
              <button type="button" className="link-btn danger" onClick={() => handleDecide(r, 'reject')}>Reject</button>
            </>
          )}
          {r.status === 'awaiting_return' && canApproveMedical && (
            <button type="button" className="link-btn primary" onClick={() => setRecordingReturn(r)}>Record return</button>
          )}
          {canOverride && ['pending', 'approved', 'awaiting_return'].includes(r.status) && (
            <button type="button" className="link-btn" onClick={() => handleCancel(r)}>Cancel</button>
          )}
        </div>
      ),
    },
  ];

  const filterToolbar = (
    <>
      {effectiveTab === 'review' && (
        <input className="filter-input search" placeholder="Search applicant..." value={applicantFilter} onChange={(e) => setApplicantFilter(e.target.value)} />
      )}
      <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
        <option value="">All leave types</option>
        {leaveTypes.map((lt) => <option key={lt.id} value={lt.name}>{label(lt.name)}</option>)}
      </select>
      <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="awaiting_return">Awaiting Return</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </>
  );

  return (
    <AppShell title="Leave Applications">
      <div className="page-header">
        <div>
          <h1>Leave Applications</h1>
          <p>Submit, track, and manage leave requests</p>
        </div>
        {!isManager && (
          <div className="page-header-actions">
            <button type="button" className="btn" onClick={() => setApplying(true)}>+ Apply for Leave</button>
          </div>
        )}
      </div>

      {!isManager && balances.length > 0 && (
        <div className="stat-grid">
          {balances.map((b) => (
            <div className="stat-card" key={b.leaveType}>
              <div className="stat-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" />
                </svg>
              </div>
              <div>
                <div className="value">{b.remainingDays}</div>
                <div className="label">
                  {label(b.leaveType)} days remaining
                  {b.leaveType === 'medical' && Number(b.unpaidDays) > 0 && (
                    <> · <span className="badge badge-red">{b.unpaidDays} unpaid</span></>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!isManager && canReview) && (
        <div className="page-tabs">
          <button type="button" className={`page-tab-btn${tab === 'my' ? ' active' : ''}`} onClick={() => setTab('my')}>My Requests</button>
          <button type="button" className={`page-tab-btn${tab === 'review' ? ' active' : ''}`} onClick={() => setTab('review')}>Review Queue</button>
        </div>
      )}

      {effectiveTab === 'my' && !isManager && (
        <DataTable
          columns={myColumns}
          rows={myRows}
          loading={loading}
          title="My Requests"
          emptyMessage="No leave requests yet."
          toolbar={filterToolbar}
        />
      )}

      {effectiveTab === 'review' && canReview && (
        <DataTable
          columns={reviewColumns}
          rows={reviewRows}
          loading={loading}
          title="Review Queue"
          emptyMessage="No requests match these filters."
          toolbar={filterToolbar}
        />
      )}

      {applying && (
        <ApplyLeaveModal
          leaveTypes={leaveTypes}
          balances={balances}
          onClose={() => setApplying(false)}
          onSubmitted={() => {
            setApplying(false);
            load();
          }}
        />
      )}

      {recordingReturn && (
        <RecordReturnModal
          request={recordingReturn}
          onClose={() => setRecordingReturn(null)}
          onRecorded={() => {
            setRecordingReturn(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function RecordReturnModal({ request, onClose, onRecorded }) {
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const estimatedDays = estimateWorkingDays(request.startDate, endDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!endDate) {
      alertError('Missing information', 'Please select the return date.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/leave/requests/${request.id}/medical-return`, { method: 'POST', body: { endDate } });
      toastSuccess('Return date recorded');
      onRecorded();
    } catch (err) {
      alertError('Could not record return date.', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Record Return — ${request.applicant?.fullName || 'Staff'}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="record-return-form" disabled={saving}>{saving ? 'Saving...' : 'Record return date'}</button>
        </>
      }
    >
      <form id="record-return-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field full">
            <div className="hint">Medical leave started {fmtDate(request.startDate)}. Select the last day of the leave (the day before they returned to work).</div>
          </div>
          <div className="field full">
            <label>Return date <span className="required-star">*</span></label>
            <input type="date" min={request.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {endDate && (
            <div className="field full">
              <div className="hint">
                ≈ {estimatedDays} working day(s) away (weekends and public holidays excluded on save). Any days beyond
                the remaining medical leave balance will be recorded as unpaid.
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

function ApplyLeaveModal({ leaveTypes, balances, onClose, onSubmitted }) {
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [mcFile, setMcFile] = useState(null);
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedType = leaveTypes.find((lt) => lt.id === leaveTypeId);
  const isMedical = selectedType?.name === 'medical';
  const balance = balances.find((b) => b.leaveType === selectedType?.name);
  const workingDays = estimateWorkingDays(startDate, endDate);

  const handleMcChange = async (file) => {
    setMcFile(file);
    setUploadedFileId(null);
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFetchForm('/files/mc-document', formData);
      setUploadedFileId(result.file.id);
    } catch (err) {
      alertError('Could not upload document.', err.message);
      setMcFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leaveTypeId || !startDate || (!isMedical && !endDate)) {
      alertError('Missing information', isMedical ? 'Please select a leave type and start date.' : 'Please select a leave type and date range.');
      return;
    }
    if (selectedType?.requiresDocument && !uploadedFileId) {
      alertError('Document required', `${label(selectedType.name)} leave requires an uploaded document.`);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/leave/requests', {
        method: 'POST',
        body: {
          leaveTypeId,
          startDate,
          endDate: isMedical ? undefined : endDate,
          reason: reason || undefined,
          attachmentFileIds: uploadedFileId ? [uploadedFileId] : [],
        },
      });
      toastSuccess(isMedical ? 'Medical leave recorded' : 'Leave request submitted');
      onSubmitted();
    } catch (err) {
      alertError('Submission failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Apply for Leave"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="apply-leave-form" disabled={submitting || uploading}>
            {submitting ? 'Submitting...' : 'Submit application'}
          </button>
        </>
      }
    >
      <form id="apply-leave-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field full">
            <label>Leave type <span className="required-star">*</span></label>
            <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">Select...</option>
              {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{label(lt.name)}</option>)}
            </select>
            {balance && <div className="hint">{balance.remainingDays} day(s) remaining this year.</div>}
          </div>
          <div className={isMedical ? 'field full' : 'field'}>
            <label>Start date <span className="required-star">*</span></label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {!isMedical && (
            <div className="field">
              <label>End date <span className="required-star">*</span></label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
          {isMedical && startDate && (
            <div className="field full">
              <div className="hint">
                No end date needed — medical leave has no fixed return date. Once you're back, an admin will record your
                return date, which finalizes the day count against your medical leave balance.
              </div>
            </div>
          )}
          {!isMedical && startDate && endDate && (
            <div className="field full">
              <div className="hint">≈ {workingDays} working day(s) selected (weekends excluded; public holidays excluded on submission).</div>
            </div>
          )}
          <div className="field full">
            <label>Reason</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {selectedType?.requiresDocument && (
            <div className="field full">
              <label>Supporting document (MC) <span className="required-star">*</span></label>
              <FileUploadField id="mc" accept=".pdf,.jpg,.jpeg,.png" file={mcFile} onChange={handleMcChange} />
              <div className="hint">{uploading ? 'Uploading...' : 'PDF, JPG, or PNG, up to 5MB.'}</div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
