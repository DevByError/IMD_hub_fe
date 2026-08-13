// Temporary, front-end-only data layer for the Refund Application module.
// There's no backend for this yet (see project discussion — UI first, wire
// up the API once the workflow itself is settled), so submissions live in
// the browser's localStorage instead of a real database. Every function
// here is written to mirror the shape a real API would eventually have
// (create/list/get/update against one collection) specifically so that
// swapping this out for `apiFetch` calls later is a small, mechanical
// change rather than a rewrite of whatever pages consume it.
//
// Do not build real workflow/permission logic on top of this file — it has
// none of the actual authorization, audit, or notification guarantees the
// rest of the app relies on (see be/src/services/permission.service.js).
// It exists purely so the multi-role review pipeline (Marketing → Accept →
// Approve → Accounts) can be demoed end-to-end before the backend exists.

const STORAGE_KEY = 'imd_hub_refund_applications_v1';

// The full lifecycle a refund application moves through. Only PENDING_MARKETING
// is actually produced by the UI built so far (the student intake form) — the
// rest are here so the statuses are locked in ahead of building the Marketing/
// Accept/Approve/Accounts screens against them.
export const REFUND_STATUS = {
  PENDING_MARKETING: 'pending_marketing',
  PENDING_ACCEPT: 'pending_accept',
  PENDING_APPROVE: 'pending_approve',
  PENDING_ACCOUNTS: 'pending_accounts',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
};

const isBrowser = () => typeof window !== 'undefined';

const readAll = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

const writeAll = (rows) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const randomId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const REF_COUNTER_KEY = 'imd_hub_refund_ref_counter_v1';

// e.g. "RF0001", "RF0002", ... — a plain incrementing counter kept in
// localStorage, since that's the only persistence this mock layer has.
// Padded to 4 digits and grows past that naturally (RF10000, ...) rather
// than wrapping. NOT safe against two submissions racing each other (two
// tabs could read the same counter value before either writes it back) —
// that's fine for a single person clicking through a demo, but the real
// backend needs an actual atomic sequence (a DB auto-increment column or a
// SELECT ... FOR UPDATE counter row), not this, once this goes live.
const nextRefNumber = () => {
  if (!isBrowser()) return 'RF0001';
  const current = Number(window.localStorage.getItem(REF_COUNTER_KEY) || '0');
  const next = current + 1;
  window.localStorage.setItem(REF_COUNTER_KEY, String(next));
  return `RF${String(next).padStart(4, '0')}`;
};

export const createRefundApplication = (data) => {
  const now = new Date().toISOString();
  const application = {
    id: randomId(),
    refNumber: nextRefNumber(),
    status: REFUND_STATUS.PENDING_MARKETING,
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  writeAll([application, ...readAll()]);
  return application;
};

export const listRefundApplications = () => readAll();

export const getRefundApplication = (id) => readAll().find((a) => a.id === id) || null;

export const updateRefundApplication = (id, patch) => {
  const rows = readAll();
  const idx = rows.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(rows);
  return rows[idx];
};
