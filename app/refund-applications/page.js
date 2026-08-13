'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { alertError, confirmAction, promptText, toastSuccess } from '@/lib/alerts';
import AppShell from '@/components/AppShell';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import FileUploadField from '@/components/FileUploadField';
import { REFUND_STATUS, listRefundApplications, updateRefundApplication } from '@/lib/refundMockStore';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
const idTypeLabel = (app) => (app.idType === 'luc' ? 'LUC ID' : 'Student ID');

// Reads the receipt File into a base64 data URL so it can be persisted in
// the mock localStorage store and reopened later from the Completed view.
// This stands in for real file storage (uploading to disk/S3 and keeping a
// URL) — fine for demoing the pipeline end-to-end, but base64-in-
// localStorage should not carry over to the real backend-wired version.
const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Each queue a staff member can act on, in pipeline order, plus the two
// terminal, read-only views. `status` is which REFUND_STATUS value lands a
// row in that tab. NOTE: in the real (backend-wired) version, a given staff
// member would only ever see the tab(s) matching their own permission —
// Marketing wouldn't see the Approve queue, Accounts wouldn't see Marketing,
// etc. There's no such gating yet (no refund.* permissions exist on the
// backend), so every tab is visible to anyone here — this page is for
// reviewing/demoing the whole pipeline in one place, not the real
// role-scoped experience.
const STAGES = [
  { id: 'marketing', label: 'Marketing', status: REFUND_STATUS.PENDING_MARKETING },
  { id: 'accept', label: 'Accept', status: REFUND_STATUS.PENDING_ACCEPT },
  { id: 'approve', label: 'Approve', status: REFUND_STATUS.PENDING_APPROVE },
  { id: 'accounts', label: 'Accounts', status: REFUND_STATUS.PENDING_ACCOUNTS },
  { id: 'completed', label: 'Completed', status: REFUND_STATUS.COMPLETED },
  { id: 'rejected', label: 'Rejected', status: REFUND_STATUS.REJECTED },
];

// Placeholder breakdown — real category names/list to be provided later
// (you mentioned tuition fees, visa, and security so far, "or more"). Adding
// a category later is just adding a row here; every amount defaults to 0
// and 0 is a valid, acceptable value for any of them (e.g. a student with
// no visa fee to refund just leaves that row at 0).
const REFUND_ITEM_TYPES = [
  { key: 'tuitionFees', label: 'Tuition Fees' },
  { key: 'visa', label: 'Visa' },
  { key: 'security', label: 'Security' },
  { key: 'other', label: 'Other' },
];

// Empty string, not 0 — an actual 0 sitting in the field means typing "50"
// produces "050" (the cursor lands after the existing digit, not replacing
// it). Blank reads as "not entered yet" and totalOf()/fmtMoney() below both
// already treat a blank/undefined amount as 0 for the total and for the
// read-only display, so nothing downstream needs to change.
const defaultAmounts = () => Object.fromEntries(REFUND_ITEM_TYPES.map((t) => [t.key, '']));

const totalOf = (amounts) => REFUND_ITEM_TYPES.reduce((sum, t) => sum + (Number(amounts?.[t.key]) || 0), 0);

const fmtMoney = (n) => `MR ${Number(n || 0).toFixed(2)}`;

export default function RefundApplicationsPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('marketing');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null); // { application, stageId }

  const load = () => {
    setLoading(true);
    setApplications(listRefundApplications());
    setLoading(false);
  };

  // Wait for AuthContext's silent-session check to set the access token
  // before firing our first request (see identical comment in users/page.js)
  // — kept here for consistency even though this page currently reads from
  // localStorage, not the API, so there's nothing to actually wait on yet.
  useEffect(() => {
    if (currentUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const rowsByStage = useMemo(() => {
    const map = {};
    STAGES.forEach((s) => {
      map[s.id] = applications.filter((a) => a.status === s.status);
    });
    return map;
  }, [applications]);

  const openReview = (application, stageId) => setReviewing({ application, stageId });

  const baseColumns = [
    { key: 'refNumber', header: 'Ref #', render: (a) => <strong>{a.refNumber}</strong>, width: 110 },
    { key: 'studentName', header: 'Applicant', render: (a) => a.studentName },
    { key: 'idType', header: 'ID Type', render: (a) => idTypeLabel(a) },
    { key: 'marketingName', header: 'Marketing Officer', render: (a) => a.marketingName || '—' },
    { key: 'createdAt', header: 'Submitted', render: (a) => fmtDateTime(a.createdAt) },
  ];

  const columnsFor = (stageId) => {
    const isTerminal = stageId === 'completed' || stageId === 'rejected';
    return [
      ...baseColumns,
      { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
      {
        key: 'actions',
        header: '',
        width: 110,
        render: (a) => (
          <button type="button" className="link-btn primary" onClick={() => openReview(a, stageId)}>
            {isTerminal ? 'View' : stageId === 'accounts' ? 'Complete' : 'Review'}
          </button>
        ),
      },
    ];
  };

  const activeStage = STAGES.find((s) => s.id === tab);

  return (
    <AppShell title="Refund Applications">
      <div className="page-header">
        <div>
          <h1>Refund Applications</h1>
          <p>Marketing → Accept → Approve → Accounts pipeline for student refund applications</p>
        </div>
      </div>

      <div className="page-tabs">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`page-tab-btn${tab === s.id ? ' active' : ''}`}
            onClick={() => setTab(s.id)}
          >
            {s.label}
            {rowsByStage[s.id]?.length > 0 && s.id !== 'completed' && s.id !== 'rejected' ? ` (${rowsByStage[s.id].length})` : ''}
          </button>
        ))}
      </div>

      <DataTable
        columns={columnsFor(tab)}
        rows={rowsByStage[tab] || []}
        loading={loading}
        title={activeStage?.label}
        emptyMessage="No applications here."
      />

      {reviewing && (
        <ApplicationReviewModal
          application={reviewing.application}
          stageId={reviewing.stageId}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

// The refund amount breakdown table — one row per REFUND_ITEM_TYPES entry
// plus a computed Total row. Used editable (the current stage filling it
// in), read-only (showing what an earlier stage already recorded), and in a
// combined comparison mode (compareAmounts) that adds a read-only "Submitted
// Amount" column next to the editable/read-only main column — used on the
// Approve stage to show Marketing's figures side-by-side with Approve's in
// a single table instead of two stacked ones.
function RefundAmountTable({ amounts, onChange, readOnly = false, compareAmounts, compareLabel = 'Submitted Amount', amountLabel = 'Amount' }) {
  const total = totalOf(amounts);
  const compareTotal = compareAmounts ? totalOf(compareAmounts) : null;

  return (
    <table className={`amount-table${compareAmounts ? ' amount-table-3col' : ''}`}>
      <thead>
        <tr>
          <th>Type</th>
          {compareAmounts && <th>{compareLabel}</th>}
          <th>{amountLabel}</th>
        </tr>
      </thead>
      <tbody>
        {REFUND_ITEM_TYPES.map((item) => (
          <tr key={item.key}>
            <td>{item.label}</td>
            {compareAmounts && <td className="amount-table-compare">{fmtMoney(compareAmounts[item.key])}</td>}
            <td>
              {readOnly ? (
                fmtMoney(amounts?.[item.key])
              ) : (
                <div className="input-group">
                  <span className="input-group-prefix">MR</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={amounts[item.key]}
                    onChange={(e) => onChange({ ...amounts, [item.key]: e.target.value })}
                  />
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="amount-table-total">
          <td>Total</td>
          {compareAmounts && <td>{fmtMoney(compareTotal)}</td>}
          <td>{fmtMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

// One modal, four+ behaviors depending on `stageId`:
// - marketing / accept / approve: shows everything submitted (and whatever
//   the earlier stages already recorded), plus this stage's own input
//   fields, plus Verify/Approve + Reject actions.
// - accounts: shows everything, plus a receipt upload and a "Mark as
//   Complete" action that runs the two confirmation prompts before actually
//   completing it.
// - completed / rejected: read-only, no actions — just the full record.
function ApplicationReviewModal({ application: app, stageId, onClose, onDone }) {
  const [marketingAmounts, setMarketingAmounts] = useState(app.marketingReview?.amounts ?? defaultAmounts());
  const [marketingNotes, setMarketingNotes] = useState(app.marketingReview?.notes ?? '');
  const [acceptNotes, setAcceptNotes] = useState(app.acceptReview?.notes ?? '');
  // Deliberately NOT pre-filled from marketingReview — Approve sees Marketing's
  // submitted figures right alongside this (see the two-table layout below)
  // for comparison, but has to actually type the real amount rather than
  // just inheriting whatever Marketing entered.
  const [approveAmounts, setApproveAmounts] = useState(app.approveReview?.amounts ?? defaultAmounts());
  const [approveNotes, setApproveNotes] = useState(app.approveReview?.notes ?? '');
  const [receiptFile, setReceiptFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptDocRef = useRef(null);

  const isReadOnly = stageId === 'completed' || stageId === 'rejected';

  // Renders the off-screen RefundReceiptDocument (see below) to a canvas and
  // wraps it in a one-page PDF. Only reachable from the Completed view since
  // the document needs the approved amount + completion date to exist.
  const handleDownloadReceipt = async () => {
    if (!receiptDocRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(receiptDocRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
      pdf.save(`${app.refNumber}-refund-receipt.pdf`);
    } catch (err) {
      alertError('Download failed', 'Could not generate the receipt PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleReject = async () => {
    const reason = await promptText('Reject this application?', {
      text: `${app.studentName} — ${app.refNumber}`,
      placeholder: 'Reason for rejection...',
      confirmButtonText: 'Reject',
      required: true,
    });
    if (reason === null) return;

    updateRefundApplication(app.id, {
      status: REFUND_STATUS.REJECTED,
      rejection: { stage: stageId, reason, rejectedAt: new Date().toISOString() },
    });
    toastSuccess('Application rejected');
    onDone();
  };

  const handleVerifyMarketing = () => {
    if (!marketingNotes.trim()) {
      alertError('Missing information', 'Please provide marketing notes.');
      return;
    }
    setSaving(true);
    updateRefundApplication(app.id, {
      status: REFUND_STATUS.PENDING_ACCEPT,
      marketingReview: {
        amounts: marketingAmounts,
        total: totalOf(marketingAmounts),
        notes: marketingNotes.trim(),
        reviewedAt: new Date().toISOString(),
      },
    });
    toastSuccess('Sent to Accept');
    setSaving(false);
    onDone();
  };

  const handleVerifyAccept = () => {
    setSaving(true);
    updateRefundApplication(app.id, {
      status: REFUND_STATUS.PENDING_APPROVE,
      acceptReview: { notes: acceptNotes.trim(), reviewedAt: new Date().toISOString() },
    });
    toastSuccess('Sent to Approve');
    setSaving(false);
    onDone();
  };

  const handleApprove = () => {
    setSaving(true);
    updateRefundApplication(app.id, {
      status: REFUND_STATUS.PENDING_ACCOUNTS,
      approveReview: {
        amounts: approveAmounts,
        total: totalOf(approveAmounts),
        notes: approveNotes.trim(),
        reviewedAt: new Date().toISOString(),
      },
    });
    toastSuccess('Sent to Accounts');
    setSaving(false);
    onDone();
  };

  // The exact three-step flow described for Accounts: pick a receipt, then
  // two separate confirmations (proceed, and that the receipt is the right
  // one) before it's actually marked complete.
  const handleComplete = async () => {
    if (!receiptFile) {
      alertError('Missing information', `Please upload the receipt for ${app.studentName}.`);
      return;
    }
    const proceed = await confirmAction('Are you sure you want to proceed?', `Completing the refund for ${app.studentName}.`, {
      confirmButtonText: 'Yes, proceed',
    });
    if (!proceed) return;

    const confirmedReceipt = await confirmAction(
      'Are you sure you have shared the right receipt?',
      `This receipt (${receiptFile.name}) will be recorded as proof of payment for ${app.studentName}.`,
      { confirmButtonText: 'Yes, this is correct' }
    );
    if (!confirmedReceipt) return;

    setSaving(true);
    const receiptDataUrl = await readFileAsDataUrl(receiptFile);
    updateRefundApplication(app.id, {
      status: REFUND_STATUS.COMPLETED,
      accountsReview: {
        receiptName: receiptFile.name,
        receiptType: receiptFile.type,
        receiptDataUrl,
        completedAt: new Date().toISOString(),
      },
    });
    toastSuccess('Refund completed');
    setSaving(false);
    onDone();
  };

  const footer = isReadOnly ? (
    <>
      {stageId === 'completed' && (
        <button type="button" onClick={handleDownloadReceipt} disabled={downloading}>
          {downloading ? 'Preparing…' : 'Download Receipt'}
        </button>
      )}
      <button type="button" className="secondary" onClick={onClose}>Close</button>
    </>
  ) : (
    <>
      <button type="button" className="secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="link-btn danger" onClick={handleReject} disabled={saving}>Reject</button>
      {stageId === 'marketing' && (
        <button type="button" onClick={handleVerifyMarketing} disabled={saving}>Verify &amp; Send to Accept</button>
      )}
      {stageId === 'accept' && (
        <button type="button" onClick={handleVerifyAccept} disabled={saving}>Verify &amp; Send to Approve</button>
      )}
      {stageId === 'approve' && (
        <button type="button" onClick={handleApprove} disabled={saving}>Approve &amp; Send to Accounts</button>
      )}
      {stageId === 'accounts' && (
        <button type="button" onClick={handleComplete} disabled={saving}>Mark as Complete</button>
      )}
    </>
  );

  return (
    <Modal
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          {app.refNumber} — {app.studentName}
          <StatusBadge status={app.status} />
        </span>
      }
      onClose={onClose}
      wide
      footer={footer}
    >
      <div className="review-section">
        <div className="permission-category-label">Submitted by Student</div>
        <div className="detail-grid">
          <div className="detail-item"><div className="label">{idTypeLabel(app)}</div><div className="value">{app.idNumber}</div></div>
          <div className="detail-item"><div className="label">Full Name</div><div className="value">{app.studentName}</div></div>
          <div className="detail-item"><div className="label">Email</div><div className="value">{app.email || '—'}</div></div>
          <div className="detail-item"><div className="label">Marketing Officer</div><div className="value">{app.marketingName} ({app.marketingEmail})</div></div>
          <div className="detail-item full"><div className="label">Explanation</div><div className="value">{app.explanation}</div></div>
          <div className="detail-item">
            <div className="label">Checkout Memo</div>
            <div className={`value${app.checkoutMemo?.name ? '' : ' muted'}`}>{app.checkoutMemo?.name || 'Not provided'}</div>
          </div>
          <div className="detail-item">
            <div className="label">Declaration</div>
            <div className="value">Signed by {app.declarations?.signedName || '—'}</div>
          </div>
        </div>
      </div>

      {/* On the Approve stage, this same data is shown again right next to
          the Approve input table below (for direct side-by-side comparison)
          — skip the table here so it isn't shown twice. On Accounts, the
          submitted amount is dropped entirely: Accounts should only ever
          see the approved amount (below, in Approve Review) so there's no
          risk of paying out against the wrong figure. Notes stay visible
          either way since Accounts should still be able to check every
          other detail. */}
      {app.marketingReview && stageId !== 'approve' && (
        <div className="review-section">
          <div className="permission-category-label">Marketing Review</div>
          {stageId !== 'accounts' && <RefundAmountTable amounts={app.marketingReview.amounts} readOnly />}
          <div className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="detail-item full"><div className="label">Notes</div><div className="value">{app.marketingReview.notes}</div></div>
          </div>
        </div>
      )}

      {app.acceptReview && (
        <div className="review-section">
          <div className="permission-category-label">Accept Review</div>
          <div className="detail-grid">
            <div className="detail-item full"><div className="label">Notes</div><div className="value">{app.acceptReview.notes || '—'}</div></div>
          </div>
        </div>
      )}

      {app.approveReview && (
        <div className="review-section">
          <div className="permission-category-label">Approve Review</div>
          <RefundAmountTable amounts={app.approveReview.amounts} readOnly />
          <div className="detail-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="detail-item full"><div className="label">Notes</div><div className="value">{app.approveReview.notes || '—'}</div></div>
          </div>
        </div>
      )}

      {app.accountsReview && (
        <div className="review-section">
          <div className="permission-category-label">Accounts</div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="label">Receipt</div>
              <div className="value">
                {app.accountsReview.receiptDataUrl ? (
                  <a
                    className="detail-link"
                    href={app.accountsReview.receiptDataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {app.accountsReview.receiptName}
                  </a>
                ) : (
                  app.accountsReview.receiptName
                )}
              </div>
            </div>
            <div className="detail-item"><div className="label">Completed</div><div className="value">{fmtDateTime(app.accountsReview.completedAt)}</div></div>
          </div>
        </div>
      )}

      {app.rejection && (
        <div className="review-section">
          <div className="permission-category-label">Rejection</div>
          <div className="detail-grid">
            <div className="detail-item"><div className="label">Rejected at stage</div><div className="value">{app.rejection.stage}</div></div>
            <div className="detail-item full"><div className="label">Reason</div><div className="value">{app.rejection.reason}</div></div>
          </div>
        </div>
      )}

      {/* Placeholder fields for whichever stage is actually actionable right now — labeled generically since the exact data each role should record hasn't been finalized yet. Tinted (review-section-action) to stand out from the read-only history sections above. */}
      {stageId === 'marketing' && (
        <div className="review-section review-section-action">
          <div className="permission-category-label">Marketing — Your Review</div>
          <RefundAmountTable amounts={marketingAmounts} onChange={setMarketingAmounts} />
          <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="field full">
              <label>Marketing Notes <span className="required-star">*</span></label>
              <textarea rows={3} value={marketingNotes} onChange={(e) => setMarketingNotes(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {stageId === 'accept' && (
        <div className="review-section review-section-action">
          <div className="permission-category-label">Accept — Your Review</div>
          <div className="form-grid">
            <div className="field full">
              <label>Notes</label>
              <textarea rows={3} value={acceptNotes} onChange={(e) => setAcceptNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {stageId === 'approve' && (
        <div className="review-section review-section-action">
          <div className="permission-category-label">Approve — Your Review</div>

          <RefundAmountTable
            amounts={approveAmounts}
            onChange={setApproveAmounts}
            compareAmounts={app.marketingReview?.amounts}
            compareLabel="Submitted Amount"
            amountLabel="Approval Amount"
          />

          <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
            <div className="field full">
              <label>Approval Notes</label>
              <textarea rows={3} value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {stageId === 'accounts' && (
        <div className="review-section review-section-action">
          <div className="permission-category-label">Accounts — Complete Payment</div>
          <div className="form-grid">
            <div className="field full">
              <label>Receipt <span className="required-star">*</span></label>
              <FileUploadField accept=".pdf,.jpg,.jpeg,.png" file={receiptFile} onChange={setReceiptFile} />
              <div className="hint">Upload proof of payment for {app.studentName} after completing the transaction in your banking app.</div>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen (not display:none — html2canvas needs real layout to
          capture), only mounted for Completed so it always has an approved
          amount and completion date to show. See handleDownloadReceipt
          above and RefundReceiptDocument below. */}
      {stageId === 'completed' && <RefundReceiptDocument app={app} innerRef={receiptDocRef} />}
    </Modal>
  );
}

// The downloadable, letterhead-style PDF a completed application produces.
// Rendered off-screen and captured with html2canvas rather than laid out
// with jsPDF's own text/positioning API — that way it matches the same
// design language (fonts, spacing, colors) as the rest of the app instead
// of being hand-positioned coordinates.
function RefundReceiptDocument({ app, innerRef }) {
  const amounts = app.approveReview?.amounts;
  const total = totalOf(amounts);

  const fields = [
    ['Reference number', app.refNumber],
    ['Student name', app.studentName],
    [idTypeLabel(app), app.idNumber],
    ['Student email', app.email || '—'],
    ['Marketing officer', app.marketingName || '—'],
    ['Marketing officer email', app.marketingEmail || '—'],
    ['Date submitted', fmtDateTime(app.createdAt)],
    ['Date completed', fmtDateTime(app.accountsReview?.completedAt)],
  ];

  return (
    <div
      ref={innerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: '-10000px',
        width: '595px',
        background: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#1a1a1a',
      }}
    >
      <div style={{ position: 'relative', padding: '48px 52px 40px' }}>
        <img
          src="/doc-bg.png"
          alt=""
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '58%',
            opacity: 0.06,
          }}
        />

        <div style={{ position: 'relative', textAlign: 'center', borderBottom: '2px solid #c53030', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.3 }}>Lincoln University College</div>
          <div style={{ fontSize: 13, color: '#5f5e5a', marginTop: 4 }}>International Marketing Department</div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontSize: 12,
              letterSpacing: 1,
              color: '#791f1f',
              background: '#fcebeb',
              padding: '5px 16px',
              borderRadius: 3,
              fontWeight: 700,
            }}
          >
            REFUND APPLICATION
          </div>
        </div>

        <table style={{ position: 'relative', width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {fields.map(([label, value]) => (
              <tr key={label} style={{ borderTop: '0.5px solid #e2e2e5' }}>
                <td style={{ padding: '8px 0', color: '#5f5e5a', width: '42%' }}>{label}</td>
                <td style={{ padding: '8px 0', fontWeight: 500 }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ position: 'relative', marginTop: 16, paddingTop: 12, borderTop: '0.5px solid #e2e2e5' }}>
          <div style={{ fontSize: 11, color: '#5f5e5a', marginBottom: 4 }}>Explanation</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{app.explanation}</div>
        </div>

        <div style={{ position: 'relative', marginTop: 22 }}>
          <div style={{ fontSize: 11, color: '#5f5e5a', marginBottom: 6 }}>Approved refund amount</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left', padding: '6px 0', borderBottom: '1px solid #1a1a1a',
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#5f5e5a',
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    textAlign: 'right', padding: '6px 0', borderBottom: '1px solid #1a1a1a',
                    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: '#5f5e5a',
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {REFUND_ITEM_TYPES.map((item) => (
                <tr key={item.key} style={{ borderBottom: '0.5px solid #e2e2e5' }}>
                  <td style={{ padding: '6px 0' }}>{item.label}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>{fmtMoney(amounts?.[item.key])}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '10px 0 0', fontWeight: 700, borderTop: '2px solid #1a1a1a' }}>Total</td>
                <td style={{ padding: '10px 0 0', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #1a1a1a', color: '#791f1f' }}>
                  {fmtMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ position: 'relative', marginTop: 36, paddingTop: 14, borderTop: '0.5px solid #e2e2e5', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#888780' }}>This record is securely stored and verified by IMD HUB.</div>
          <div style={{ fontSize: 10, color: '#b4b2a9', marginTop: 3 }}>Generated {fmtDateTime(new Date().toISOString())}</div>
        </div>
      </div>
    </div>
  );
}
